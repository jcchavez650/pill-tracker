import { prisma } from "./prisma";
import { parseDataUrl } from "./anthropic";
import type { Photo } from "@prisma/client";

/**
 * Persist a base64 data-URL image into the database (as bytes) and return the
 * created Photo row. Storing image bytes in the DB means photos survive
 * redeploys without a mounted volume or external object storage — the whole
 * app persists in one managed Postgres database.
 *
 * The row's `url` is the serving path `/api/uploads/<id>`.
 */
export async function savePhoto(
  dataUrl: string,
  kind: "confirmation" | "reference" | "question",
  uploadedById: string
): Promise<Photo> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("INVALID_IMAGE");

  const bytes = Buffer.from(parsed.data, "base64");

  const photo = await prisma.photo.create({
    data: {
      url: "", // filled in below once we have the id
      kind,
      data: bytes,
      contentType: parsed.mediaType,
      uploadedById,
    },
  });

  return prisma.photo.update({
    where: { id: photo.id },
    data: { url: `/api/uploads/${photo.id}` },
  });
}
