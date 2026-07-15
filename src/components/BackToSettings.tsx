"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

/** Compact "back to Settings" link shown on the management sub-pages. */
export function BackToSettings() {
  const { t } = useI18n();
  return (
    <Link
      href="/settings"
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-cream/60 transition hover:text-champagne-soft"
    >
      <span aria-hidden>←</span> {t("nav.settings")}
    </Link>
  );
}
