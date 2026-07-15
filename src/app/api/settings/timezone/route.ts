import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isValidTimezone } from "@/lib/tz";

/**
 * POST /api/settings/timezone
 * Body: { timezone, includeSelf?, patientId? }
 *
 * - Sets the caller's timezone (unless includeSelf === false).
 * - If the caller is a caregiver, any managed patient still on the default
 *   "UTC" is moved to the same timezone (so a patient's schedule follows the
 *   caregiver's local clock until set otherwise). A specific `patientId` can be
 *   targeted to set just that patient.
 * - Any user whose timezone actually changes has their future still-PENDING
 *   doses cleared, so they re-materialize at the corrected instants.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const timezone = body?.timezone;
  if (typeof timezone !== "string" || !isValidTimezone(timezone)) {
    return NextResponse.json({ error: "BAD_TZ" }, { status: 400 });
  }
  const includeSelf = body?.includeSelf !== false;

  const changed: string[] = [];

  if (includeSelf && user.timezone !== timezone) {
    await prisma.user.update({ where: { id: user.id }, data: { timezone } });
    changed.push(user.id);
  }

  if (user.role === "CAREGIVER") {
    if (typeof body?.patientId === "string") {
      // Set a specific managed patient's timezone.
      const p = await prisma.user.findFirst({
        where: { id: body.patientId, caregiverId: user.id },
        select: { id: true, timezone: true },
      });
      if (p && p.timezone !== timezone) {
        await prisma.user.update({ where: { id: p.id }, data: { timezone } });
        changed.push(p.id);
      }
    } else {
      // Move any managed patients still on default UTC onto this timezone.
      const utcPatients = await prisma.user.findMany({
        where: { caregiverId: user.id, timezone: "UTC" },
        select: { id: true },
      });
      for (const p of utcPatients) {
        await prisma.user.update({
          where: { id: p.id },
          data: { timezone },
        });
        changed.push(p.id);
      }
    }
  }

  // Clear future pending doses for changed users so they regenerate correctly.
  if (changed.length > 0) {
    await prisma.doseLog.deleteMany({
      where: {
        patientId: { in: changed },
        status: "PENDING",
        scheduledFor: { gte: new Date() },
      },
    });
  }

  return NextResponse.json({ ok: true, timezone, changed: changed.length });
}
