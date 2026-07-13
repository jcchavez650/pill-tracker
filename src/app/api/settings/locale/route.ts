import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { locale } = await req.json();
  const value = locale === "es" ? "es" : "en";

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: value },
    });
  }
  return NextResponse.json({ ok: true });
}
