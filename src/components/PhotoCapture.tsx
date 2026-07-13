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
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      onChange(dataUrl);
    } catch {
      // ignore
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
              className="btn-ghost flex-1"
              onClick={() => inputRef.current?.click()}
            >
              {t("common.retake")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed border-champagne/30 bg-ink-muted/40 px-6 py-12 text-center transition hover:border-champagne/60"
        >
          <span className="text-4xl" aria-hidden>
            📷
          </span>
          <span className="text-sm font-medium text-cream/80">
            {busy ? t("common.loading") : label || t("common.openCamera")}
          </span>
        </button>
      )}
    </div>
  );
}
