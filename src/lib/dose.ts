import { prisma } from "./prisma";

// Re-export client-safe status helpers for server callers' convenience.
export {
  DUE_WINDOW_MS,
  MISSED_AFTER_MS,
  displayStatus,
} from "./doseStatus";
export type { DisplayStatus } from "./doseStatus";

/** Local calendar helpers operating in the server's timezone. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Combine a date with an "HH:MM" string into a Date on that day. */
export function dateAtTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const x = startOfDay(day);
  x.setHours(h || 0, m || 0, 0, 0);
  return x;
}

/**
 * Ensure DoseLog rows exist for all of a patient's active medications on `day`.
 * Idempotent: uses the (medicationId, scheduledFor) unique key.
 */
export async function materializeDoses(
  patientId: string,
  day: Date
): Promise<void> {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const meds = await prisma.medication.findMany({
    where: {
      patientId,
      active: true,
      startDate: { lte: dayEnd },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
    },
    include: { times: true },
  });

  const rows: { medicationId: string; scheduledFor: Date }[] = [];
  for (const med of meds) {
    for (const t of med.times) {
      rows.push({ medicationId: med.id, scheduledFor: dateAtTime(day, t.time) });
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
