"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Downscale an image File to a JPEG data URL (max edge ~1280px) to keep
 * uploads small and fast for the AI vision calls.
 */
function fileToScaledDataUrl(file: File, maxEdge = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no-ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoCapture({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}) {
  const { t } = useI18n();
  // Two inputs: one opens the camera (capture), one opens the photo library.
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires change again.
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      onChange(dataUrl);
    } catch {
      // ignore decode errors
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Camera: capture attribute asks mobile to open the camera directly. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {/* Gallery: no capture attribute → opens the photo library / file picker. */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      {value ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label || "photo"}
            className="w-full rounded-xl2 border border-white/10 object-cover shadow-luxe"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost flex-1 !py-2 text-xs"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
            >
              📷 {t("common.takePhoto")}
            </button>
            <button
              type="button"
              className="btn-ghost flex-1 !py-2 text-xs"
              onClick={() => galleryRef.current?.click()}
              disabled={busy}
            >
              🖼️ {t("common.gallery")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl2 border-2 border-dashed border-champagne/30 bg-ink-muted/40 px-6 py-8 text-center">
          <span className="text-4xl" aria-hidden>
            📷
          </span>
          {label && (
            <p className="text-sm font-medium text-cream/80">
              {busy ? t("common.loading") : label}
            </p>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="btn-gold flex-1 !py-2.5 text-sm"
            >
              📷 {t("common.takePhoto")}
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={busy}
              className="btn-ghost flex-1 !py-2.5 text-sm"
            >
              🖼️ {t("common.gallery")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
