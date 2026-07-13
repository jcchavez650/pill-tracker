import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";

// POST /api/doses/[id]/skip — mark a dose as intentionally skipped.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const dose = await prisma.doseLog.findUnique({ where: { id } });
  if (!dose) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patientId = await resolvePatientId(user, dose.patientId);
  if (patientId !== dose.patientId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const updated = await prisma.doseLog.update({
    where: { id },
    data: { status: "SKIPPED" },
  });
  return NextResponse.json({ dose: updated });
}
