import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { materializeDoses, getPatientTimezone } from "@/lib/dose";
import { dayRangeInTz, todayYMD } from "@/lib/tz";

// GET /api/reports?range=7|30&patientId=...
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(user, searchParams.get("patientId"));
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const range = searchParams.get("range") === "30" ? 30 : 7;
  const tz = await getPatientTimezone(patientId);

  // Materialize doses for each calendar day in range (in the patient's tz) so
  // history reflects the schedule even for days the app wasn't opened.
  const days: string[] = [];
  for (let i = range - 1; i >= 0; i--) days.push(todayYMD(tz, -i));
  for (const ymd of days) await materializeDoses(patientId, ymd, tz);

  const from = dayRangeInTz(days[0], tz).start;
  const to = dayRangeInTz(days[days.length - 1], tz).end;

  const doses = await prisma.doseLog.findMany({
    where: { patientId, scheduledFor: { gte: from, lte: to } },
    include: {
      medication: true,
      confirmationPhoto: { select: { id: true, url: true } },
    },
    orderBy: { scheduledFor: "desc" },
  });

  const now = Date.now();
  const counts = { TAKEN: 0, MISSED: 0, SKIPPED: 0, PENDING: 0 };
  for (const d of doses) {
    if (d.status === "TAKEN") counts.TAKEN++;
    else if (d.status === "SKIPPED") counts.SKIPPED++;
    else if (d.status === "MISSED") counts.MISSED++;
    else {
      // PENDING in the past (>2h) counts as missed for reporting.
      if (now - d.scheduledFor.getTime() > 2 * 60 * 60 * 1000) counts.MISSED++;
      else counts.PENDING++;
    }
  }

  const scheduled = counts.TAKEN + counts.MISSED; // skipped/pending excluded
  const adherence = scheduled === 0 ? null : Math.round((counts.TAKEN / scheduled) * 100);

  return NextResponse.json({ counts, adherence, range, doses });
}
