import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import crypto from "crypto";

// GET — list patients managed by the current caregiver.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  if (user.role !== "CAREGIVER")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const patients = await prisma.user.findMany({
    where: { caregiverId: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      notifyCaregiver: true,
      _count: { select: { medications: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ patients });
}

// POST — create a patient login under this caregiver.
// Body: { name, email, password?, locale? }. Returns a temp password if generated.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  if (user.role !== "CAREGIVER")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { name, email, password, locale } = await req.json();
  if (!name || !email)
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing)
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });

  const tempPassword =
    password && String(password).length >= 4
      ? String(password)
      : crypto.randomBytes(4).toString("hex");

  const patient = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(tempPassword),
      role: "PATIENT",
      locale: locale === "es" ? "es" : "en",
      caregiverId: user.id,
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({
    patient,
    tempPassword: password ? undefined : tempPassword,
  });
}
