import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { savePhoto } from "@/lib/upload";
import { identifyPill } from "@/lib/anthropic";
import type { Locale } from "@/lib/i18n";

// GET — recent identifications for the current user.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const items = await prisma.pillQuestion.findMany({
    where: { userId: user.id },
    include: { photo: { select: { id: true, url: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ items });
}

// POST — identify a pill from a photo. Body: { photo: dataUrl, question?, locale? }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json();
  const locale: Locale = body.locale === "es" ? "es" : "en";

  if (typeof body.photo !== "string" || !body.photo.startsWith("data:")) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
  }

  const photo = await savePhoto(body.photo, "question", user.id);

  let answer = "";
  try {
    const result = await identifyPill(
      body.photo,
      typeof body.question === "string" ? body.question : undefined,
      locale
    );
    answer = result.answer;
  } catch {
    answer =
      locale === "es"
        ? "No se pudo analizar la imagen. Inténtalo de nuevo."
        : "Could not analyze the image. Please try again.";
  }

  const record = await prisma.pillQuestion.create({
    data: {
      userId: user.id,
      question: typeof body.question === "string" ? body.question : null,
      aiAnswer: answer,
      photoId: photo.id,
    },
    include: { photo: { select: { id: true, url: true } } },
  });

  return NextResponse.json({ item: record });
}
