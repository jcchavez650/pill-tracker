import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/patients/[id] — update settings for a managed patient.
// Body: { notifyCaregiver?: boolean }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  if (user.role !== "CAREGIVER")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const patient = await prisma.user.findFirst({
    where: { id, caregiverId: user.id },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.notifyCaregiver === "boolean")
    data.notifyCaregiver = body.notifyCaregiver;

  const updated = await prisma.user.update({
    where: { id: patient.id },
    data,
    select: { id: true, notifyCaregiver: true },
  });
  return NextResponse.json({ patient: updated });
}
