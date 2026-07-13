import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { parseDataUrl } from "./anthropic";

/**
 * Directory where uploaded photos are stored.
 * - Local dev: defaults to ./public/uploads
 * - Railway (or any host with a persistent disk): set UPLOAD_DIR to a path on
 *   the mounted volume, e.g. /data/uploads, so photos survive redeploys.
 *
 * Files are always served back through /api/uploads/<name>, so serving does not
 * depend on the file living under Next's public/ folder.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

/**
 * Persist a base64 data-URL image and return its public URL
 * (`/api/uploads/<filename>`).
 */
export async function saveImage(dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error("INVALID_IMAGE");

  const ext =
    parsed.mediaType === "image/png"
      ? "png"
      : parsed.mediaType === "image/webp"
      ? "webp"
      : "jpg";
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(parsed.data, "base64"));

  return `/api/uploads/${name}`;
}
