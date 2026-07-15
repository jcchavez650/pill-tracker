import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import crypto from "crypto";

// POST /api/patients/[id]/password — caregiver resets a managed patient's
// password. Body: { password? } (generated if omitted). Returns the new password.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  if (user.role !== "CAREGIVER")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const patient = await prisma.user.findFirst({
    where: { id, caregiverId: user.id },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { password } = await req.json().catch(() => ({}));
  const newPassword =
    typeof password === "string" && password.length >= 4
      ? password
      : crypto.randomBytes(4).toString("hex");

  await prisma.user.update({
    where: { id: patient.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true, password: newPassword });
}
