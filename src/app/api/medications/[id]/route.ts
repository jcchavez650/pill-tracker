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

async function authorizeMed(medId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "UNAUTH" as const, status: 401 };
  const med = await prisma.medication.findUnique({ where: { id: medId } });
  if (!med) return { error: "NOT_FOUND" as const, status: 404 };
  const patientId = await resolvePatientId(user, med.patientId);
  if (patientId !== med.patientId)
    return { error: "FORBIDDEN" as const, status: 403 };
  return { user, med };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorizeMed(id);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const {
    name,
    strength,
    form,
    instructions,
    color,
    shape,
    imprint,
    referencePhoto,
    active,
    times,
    asNeeded,
    daysOfWeek,
    quantityPerDose,
    supplyCount,
    supplyThreshold,
    startDate,
    endDate,
  } = body;

  let referencePhotoUrl: string | undefined;
  if (typeof referencePhoto === "string" && referencePhoto.startsWith("data:")) {
    const photo = await savePhoto(referencePhoto, "reference", auth.user.id);
    referencePhotoUrl = photo.url;
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (strength !== undefined) data.strength = strength || null;
  if (form !== undefined) data.form = form || null;
  if (instructions !== undefined) data.instructions = instructions || null;
  if (color !== undefined) data.color = color || null;
  if (shape !== undefined) data.shape = shape || null;
  if (imprint !== undefined) data.imprint = imprint || null;
  if (active !== undefined) data.active = Boolean(active);
  if (referencePhotoUrl !== undefined) data.referencePhotoUrl = referencePhotoUrl;
  if (asNeeded !== undefined) data.asNeeded = Boolean(asNeeded);
  if (daysOfWeek !== undefined) data.daysOfWeek = sanitizeDaysOfWeek(daysOfWeek);
  if (quantityPerDose !== undefined) {
    const q = intOrNull(quantityPerDose);
    data.quantityPerDose = q && q > 0 ? q : 1;
  }
  if (supplyCount !== undefined) {
    data.supplyCount = intOrNull(supplyCount);
    // Re-arm the low-supply alert whenever supply is (re)set.
    data.lowSupplyNotified = false;
  }
  if (supplyThreshold !== undefined) data.supplyThreshold = intOrNull(supplyThreshold);
  const startD = optionalDate(startDate);
  if (startD) data.startDate = startD;
  const endD = optionalDate(endDate);
  if (endDate !== undefined) data.endDate = endD ?? null;

  if (Array.isArray(times)) {
    data.times = {
      deleteMany: {},
      create: (Boolean(asNeeded) ? [] : cleanTimes(times)).map((time) => ({
        time,
      })),
    };
  }

  const med = await prisma.medication.update({
    where: { id },
    data,
    include: { times: { orderBy: { time: "asc" } } },
  });

  return NextResponse.json({ medication: med });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorizeMed(id);
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  await prisma.medication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
