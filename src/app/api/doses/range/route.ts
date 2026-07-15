import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { materializeDoses, getPatientTimezone } from "@/lib/dose";
import { dayRangeInTz, todayYMD } from "@/lib/tz";

// GET /api/doses/range?patientId=...&start=YYYY-MM-DD&days=7
// Returns doses for `days` consecutive calendar days (patient timezone),
// grouped by day, for the weekly view.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(user, searchParams.get("patientId"));
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const tz = await getPatientTimezone(patientId);
  const start = searchParams.get("start") || todayYMD(tz);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "BAD_DATE" }, { status: 400 });
  }
  const days = Math.min(14, Math.max(1, parseInt(searchParams.get("days") || "7", 10)));

  // Build the list of calendar days starting at `start`.
  const startMs = dayRangeInTz(start, tz).start.getTime();
  const ymds: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    // Format that instant's calendar day in tz.
    ymds.push(todayYMDForInstant(d, tz));
  }

  for (const ymd of ymds) await materializeDoses(patientId, ymd, tz);

  const rangeStart = dayRangeInTz(ymds[0], tz).start;
  const rangeEnd = dayRangeInTz(ymds[ymds.length - 1], tz).end;

  const doses = await prisma.doseLog.findMany({
    where: { patientId, scheduledFor: { gte: rangeStart, lte: rangeEnd } },
    include: { medication: true },
    orderBy: { scheduledFor: "asc" },
  });

  return NextResponse.json({ days: ymds, doses, tz });
}

// Local helper: calendar YMD (in tz) for a specific instant.
function todayYMDForInstant(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  // en-CA yields YYYY-MM-DD
  return parts;
}
