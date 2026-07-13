import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { materializeDoses, startOfDay, endOfDay } from "@/lib/dose";

// GET /api/reports?range=7|30&patientId=...
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(user, searchParams.get("patientId"));
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const range = searchParams.get("range") === "30" ? 30 : 7;

  const today = new Date();
  const from = startOfDay(new Date(today.getTime() - (range - 1) * 86400000));
  const to = endOfDay(today);

  // Materialize doses for each day in range so history reflects the schedule
  // even for days the app wasn't opened.
  for (let i = 0; i < range; i++) {
    const day = new Date(from.getTime() + i * 86400000);
    if (day <= today) await materializeDoses(patientId, day);
  }

  const doses = await prisma.doseLog.findMany({
    where: { patientId, scheduledFor: { gte: from, lte: to } },
    include: { medication: true, confirmationPhoto: true },
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
