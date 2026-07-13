import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { parseDataUrl } from "./anthropic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Persist a base64 data-URL image to /public/uploads and return its public URL.
 * NOTE: For production behind a serverless/ephemeral host, swap this for an
 * object store (S3/R2). The interface (data URL in, URL out) stays the same.
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

  return `/uploads/${name}`;
}
