import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";

// GET /api/uploads/<id> — stream a stored photo's bytes from the database.
// Access is restricted: the requester must be the uploader, or a user who can
// access the patient the photo belongs to (dose confirmation or medication
// reference photo).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { dose: { select: { patientId: true } } },
  });
  if (!photo) return new NextResponse("Not found", { status: 404 });

  // 1) The uploader can always view their own photo.
  let allowed = photo.uploadedById === user.id;

  // 2) A confirmation photo is viewable by anyone who can access that patient
  //    (the patient themselves or their managing caregiver).
  if (!allowed && photo.dose) {
    allowed =
      (await resolvePatientId(user, photo.dose.patientId)) ===
      photo.dose.patientId;
  }

  // 3) A medication reference photo is viewable by anyone who can access the
  //    patient it belongs to.
  if (!allowed && photo.kind === "reference") {
    const med = await prisma.medication.findFirst({
      where: { referencePhotoUrl: `/api/uploads/${id}` },
      select: { patientId: true },
    });
    if (med) {
      allowed = (await resolvePatientId(user, med.patientId)) === med.patientId;
    }
  }

  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      "Content-Type": photo.contentType || "image/jpeg",
      // Private: cached per-user only, never by shared/proxy caches.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
