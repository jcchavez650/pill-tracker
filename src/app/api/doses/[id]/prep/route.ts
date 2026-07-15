import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";

// POST /api/doses/[id]/prep — toggle the "prepped" flag (prep checklist).
// Body: { prepped: boolean }
export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.doseLog.update({
    where: { id },
    data: { prepped: Boolean(body.prepped) },
    select: { id: true, prepped: true },
  });
  return NextResponse.json({ dose: updated });
}
