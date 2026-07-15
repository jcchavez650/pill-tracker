import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { savePhoto } from "@/lib/upload";
import { confirmDosePhoto } from "@/lib/anthropic";
import { consumeSupply } from "@/lib/supply";
import { notifyForMedication } from "@/lib/notify";
import type { Locale } from "@/lib/i18n";

/**
 * POST /api/doses/[id]/take
 * Body: { photo?: dataUrl, locale?: "en"|"es" }
 * Marks the dose taken. If a photo is provided, saves it and asks Claude to
 * confirm it matches the expected medication, storing the verdict.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const dose = await prisma.doseLog.findUnique({
    where: { id },
    include: { medication: true },
  });
  if (!dose) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patientId = await resolvePatientId(user, dose.patientId);
  if (patientId !== dose.patientId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const locale: Locale = body.locale === "es" ? "es" : "en";

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
            name: dose.medication.name,
            strength: dose.medication.strength,
            color: dose.medication.color,
            shape: dose.medication.shape,
            imprint: dose.medication.imprint,
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

  const wasTaken = dose.status === "TAKEN";

  const updated = await prisma.doseLog.update({
    where: { id },
    data: {
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

  // Decrement supply only on the first transition to TAKEN.
  if (!wasTaken) await consumeSupply(dose.medicationId);

  // On a possible mismatch, alert the person the medication is for (and their
  // caregiver if opted in). Success is shown live in the app, so no alert then.
  if (verdict === "MISMATCH") {
    await notifyForMedication(dose.patientId, {
      type: "confirmation",
      title: `⚠️ Possible mismatch: ${dose.medication.name}`,
      body: notes || "Please double-check the pills.",
      url: "/today",
    });
  }

  return NextResponse.json({ dose: updated });
}
