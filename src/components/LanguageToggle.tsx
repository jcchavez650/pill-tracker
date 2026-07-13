"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/15 bg-ink-muted/60 p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-1.5 transition ${
          locale === "en" ? "bg-gold-sheen text-ink" : "text-cream/70 hover:text-cream"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`rounded-full px-3 py-1.5 transition ${
          locale === "es" ? "bg-gold-sheen text-ink" : "text-cream/70 hover:text-cream"
        }`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
    </div>
  );
}
