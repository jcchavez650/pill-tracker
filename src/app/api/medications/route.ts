import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { savePhoto } from "@/lib/upload";
import {
  cleanTimes,
  sanitizeDaysOfWeek,
  intOrNull,
  optionalDate,
} from "@/lib/medFields";

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
    asNeeded,
    daysOfWeek,
    quantityPerDose,
    supplyCount,
    supplyThreshold,
    startDate,
    endDate,
  } = body;

  const isAsNeeded = asNeeded === true;
  const timeList = cleanTimes(times);

  // Scheduled meds need a name + at least one time; PRN meds just need a name.
  if (!name || (!isAsNeeded && timeList.length === 0)) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  // If a reference photo (base64 data URL) was supplied, persist it.
  let referencePhotoUrl: string | null = null;
  if (typeof referencePhoto === "string" && referencePhoto.startsWith("data:")) {
    const photo = await savePhoto(referencePhoto, "reference", user.id);
    referencePhotoUrl = photo.url;
  }

  const start = optionalDate(startDate);
  const end = optionalDate(endDate);
  const qty = intOrNull(quantityPerDose);

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
      asNeeded: isAsNeeded,
      daysOfWeek: sanitizeDaysOfWeek(daysOfWeek),
      quantityPerDose: qty && qty > 0 ? qty : 1,
      supplyCount: intOrNull(supplyCount),
      supplyThreshold: intOrNull(supplyThreshold),
      ...(start ? { startDate: start } : {}),
      ...(end !== undefined ? { endDate: end } : {}),
      patientId,
      createdById: user.id,
      times: { create: isAsNeeded ? [] : timeList.map((time) => ({ time })) },
    },
    include: { times: true },
  });

  return NextResponse.json({ medication: med });
}
