import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isValidTimezone } from "@/lib/tz";

// POST /api/settings/timezone — set the current user's timezone.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { timezone } = await req.json().catch(() => ({}));
  if (typeof timezone !== "string" || !isValidTimezone(timezone)) {
    return NextResponse.json({ error: "BAD_TZ" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  return NextResponse.json({ ok: true, timezone });
}
