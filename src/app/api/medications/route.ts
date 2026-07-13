import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { saveImage } from "@/lib/upload";

// GET /api/medications?patientId=...  — list a patient's medications
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(
    user,
    searchParams.get("patientId")
  );
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const meds = await prisma.medication.findMany({
    where: { patientId },
    include: { times: { orderBy: { time: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ medications: meds });
}

// POST /api/medications  — create a medication
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json();
  const patientId = await resolvePatientId(user, body.patientId);
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const {
    name,
    strength,
    form,
    instructions,
    color,
    shape,
    imprint,
    referencePhoto,
    times,
  } = body;

  if (!name || !Array.isArray(times) || times.length === 0) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  // If a reference photo (base64 data URL) was supplied, persist it.
  let referencePhotoUrl: string | null = null;
  if (typeof referencePhoto === "string" && referencePhoto.startsWith("data:")) {
    referencePhotoUrl = await saveImage(referencePhoto);
  }

  const cleanTimes: string[] = [
    ...new Set(
      (times as string[]).filter((t) => /^\d{2}:\d{2}$/.test(t))
    ),
  ].sort();

  const med = await prisma.medication.create({
    data: {
      name: String(name).trim(),
      strength: strength || null,
      form: form || null,
      instructions: instructions || null,
      color: color || null,
      shape: shape || null,
      imprint: imprint || null,
      referencePhotoUrl: referencePhotoUrl || null,
      patientId,
      createdById: user.id,
      times: { create: cleanTimes.map((time) => ({ time })) },
    },
    include: { times: true },
  });

  return NextResponse.json({ medication: med });
}
