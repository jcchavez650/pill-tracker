import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import type { Role } from "@prisma/client";

export async function POST(req: Request) {
  const { name, email, password, role, locale } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const userRole: Role = role === "CAREGIVER" ? "CAREGIVER" : "PATIENT";

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(String(password)),
      role: userRole,
      locale: locale === "es" ? "es" : "en",
    },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
