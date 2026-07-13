import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

/**
 * Resolve which patient's data a request may act on.
 * - Patients can only act on themselves.
 * - Caregivers can act on themselves or any patient they manage.
 * Returns the patient's userId, or null if not permitted.
 */
export async function resolvePatientId(
  user: SessionUser,
  requestedPatientId?: string | null
): Promise<string | null> {
  if (user.role === "PATIENT") {
    // Patients ignore any requested id and use their own.
    return user.id;
  }

  // Caregiver
  if (!requestedPatientId || requestedPatientId === user.id) {
    return user.id;
  }
  const patient = await prisma.user.findFirst({
    where: { id: requestedPatientId, caregiverId: user.id },
    select: { id: true },
  });
  return patient?.id ?? null;
}
