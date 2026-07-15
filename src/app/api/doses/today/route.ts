import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { materializeDoses, getPatientTimezone } from "@/lib/dose";
import { dayRangeInTz, todayYMD, isValidTimezone } from "@/lib/tz";

// GET /api/doses/today?patientId=...&date=YYYY-MM-DD
// `date` is a calendar day interpreted in the patient's timezone.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(user, searchParams.get("patientId"));
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const tz = await getPatientTimezone(patientId);
  const ymd = searchParams.get("date") || todayYMD(tz);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });
  }

  await materializeDoses(patientId, ymd, tz);

  const { start, end } = dayRangeInTz(ymd, tz);
  const doses = await prisma.doseLog.findMany({
    where: { patientId, scheduledFor: { gte: start, lte: end } },
    include: {
      medication: true,
      confirmationPhoto: { select: { id: true, url: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });

  // As-needed (PRN) medications available to take any time.
  const asNeeded = await prisma.medication.findMany({
    where: { patientId, active: true, asNeeded: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ doses, asNeeded, tz });
}
