import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });
  if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
    return NextResponse.json({ error: "INVALID" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
