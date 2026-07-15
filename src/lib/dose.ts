import { prisma } from "./prisma";
import {
  dayRangeInTz,
  parseYMD,
  weekdayForYMD,
  zonedTimeToUtc,
} from "./tz";

// Re-export client-safe status helpers for server callers' convenience.
export {
  DUE_WINDOW_MS,
  MISSED_AFTER_MS,
  displayStatus,
} from "./doseStatus";
export type { DisplayStatus } from "./doseStatus";

/** Look up a patient's timezone (defaults to UTC). */
export async function getPatientTimezone(patientId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: patientId },
    select: { timezone: true },
  });
  return u?.timezone || "UTC";
}

/**
 * Ensure DoseLog rows exist for all of a patient's scheduled medications on the
 * calendar day `ymd` (YYYY-MM-DD), interpreted in the patient's timezone `tz`.
 * Honors per-medication days-of-week and skips as-needed (PRN) medications.
 * Idempotent via the (medicationId, scheduledFor) unique key.
 */
export async function materializeDoses(
  patientId: string,
  ymd: string,
  tz: string
): Promise<void> {
  const { start, end } = dayRangeInTz(ymd, tz);
  const { year, month, day } = parseYMD(ymd);
  const weekday = weekdayForYMD(year, month, day, tz);

  const meds = await prisma.medication.findMany({
    where: {
      patientId,
      active: true,
      asNeeded: false,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: { times: true },
  });

  const rows: { medicationId: string; scheduledFor: Date }[] = [];
  for (const med of meds) {
    // Day-of-week filter: null/empty = every day.
    if (med.daysOfWeek && med.daysOfWeek.trim() !== "") {
      const allowed = med.daysOfWeek
        .split(",")
        .map((n) => parseInt(n, 10))
        .filter((n) => !Number.isNaN(n));
      if (!allowed.includes(weekday)) continue;
    }
    for (const t of med.times) {
      const [h, m] = t.time.split(":").map((n) => parseInt(n, 10));
      rows.push({
        medicationId: med.id,
        scheduledFor: zonedTimeToUtc(year, month, day, h || 0, m || 0, tz),
      });
    }
  }

  if (rows.length === 0) return;

  await prisma.$transaction(
    rows.map((r) =>
      prisma.doseLog.upsert({
        where: {
          medicationId_scheduledFor: {
            medicationId: r.medicationId,
            scheduledFor: r.scheduledFor,
          },
        },
        create: {
          medicationId: r.medicationId,
          scheduledFor: r.scheduledFor,
          patientId,
        },
        update: {},
      })
    )
  );
}
