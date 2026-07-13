"use client";

import { useI18n } from "@/components/I18nProvider";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-sheen text-3xl shadow-gold">
          💊
        </div>
        <h2 className="display text-2xl tracking-wide text-champagne-soft">
          {t("app.name")}
        </h2>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-cream/40">
          {t("app.tagline")}
        </p>
      </div>
      <div className="card w-full max-w-md p-8 sm:p-10">{children}</div>
    </main>
  );
}
