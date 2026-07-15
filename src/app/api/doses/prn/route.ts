import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { savePhoto } from "@/lib/upload";
import { confirmDosePhoto } from "@/lib/anthropic";
import { consumeSupply } from "@/lib/supply";
import type { Locale } from "@/lib/i18n";

// POST /api/doses/prn — log an as-needed (PRN) dose right now.
// Body: { medicationId, photo?, locale? }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const locale: Locale = body.locale === "es" ? "es" : "en";

  const med = await prisma.medication.findUnique({
    where: { id: String(body.medicationId || "") },
  });
  if (!med) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patientId = await resolvePatientId(user, med.patientId);
  if (patientId !== med.patientId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let photoId: string | undefined;
  let verdict: "MATCH" | "MISMATCH" | "UNSURE" | "UNVERIFIED" = "UNVERIFIED";
  let confidence: number | null = null;
  let notes: string | null = null;

  if (typeof body.photo === "string" && body.photo.startsWith("data:")) {
    const photo = await savePhoto(body.photo, "confirmation", user.id);
    photoId = photo.id;
    try {
      const result = await confirmDosePhoto(
        body.photo,
        [
          {
            name: med.name,
            strength: med.strength,
            color: med.color,
            shape: med.shape,
            imprint: med.imprint,
          },
        ],
        locale
      );
      verdict = result.verdict;
      confidence = result.confidence;
      notes = result.notes;
    } catch {
      verdict = "UNSURE";
      notes = "AI check failed.";
    }
  }

  const dose = await prisma.doseLog.create({
    data: {
      medicationId: med.id,
      patientId: med.patientId,
      scheduledFor: new Date(),
      status: "TAKEN",
      takenAt: new Date(),
      confirmationPhotoId: photoId,
      aiVerdict: verdict,
      aiConfidence: confidence,
      aiNotes: notes,
    },
    include: {
      medication: true,
      confirmationPhoto: { select: { id: true, url: true } },
    },
  });

  await consumeSupply(med.id);

  return NextResponse.json({ dose });
}
