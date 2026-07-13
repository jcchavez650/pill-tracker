"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthShell } from "@/components/AuthShell";

export default function SignInPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(t("auth.invalid"));
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setError(t("auth.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="display text-3xl text-cream">{t("auth.welcome")}</h1>
        <LanguageToggle />
      </div>
      <p className="mb-8 text-sm text-cream/60">{t("auth.signInSubtitle")}</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label">{t("auth.email")}</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{t("auth.password")}</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn-gold w-full" disabled={busy}>
          {busy ? t("common.loading") : t("auth.signIn")}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-cream/60">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="text-champagne hover:underline">
          {t("auth.signUp")}
        </Link>
      </p>
    </AuthShell>
  );
}
