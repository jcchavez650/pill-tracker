import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { saveImage } from "@/lib/upload";

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
  } = body;

  let referencePhotoUrl: string | undefined;
  if (typeof referencePhoto === "string" && referencePhoto.startsWith("data:")) {
    referencePhotoUrl = await saveImage(referencePhoto);
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

  if (Array.isArray(times)) {
    const cleanTimes: string[] = [
      ...new Set((times as string[]).filter((t) => /^\d{2}:\d{2}$/.test(t))),
    ].sort();
    data.times = {
      deleteMany: {},
      create: cleanTimes.map((time) => ({ time })),
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
