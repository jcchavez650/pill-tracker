"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthShell } from "@/components/AuthShell";

export default function SignUpPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CAREGIVER" | "PATIENT">("CAREGIVER");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, locale }),
      });
      if (res.status === 409) {
        setError(t("auth.emailTaken"));
        return;
      }
      if (!res.ok) {
        setError(t("auth.error"));
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
        <h1 className="display text-3xl text-cream">{t("auth.createTitle")}</h1>
        <LanguageToggle />
      </div>
      <p className="mb-8 text-sm text-cream/60">{t("auth.createSubtitle")}</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label">{t("auth.role")}</label>
          <div className="grid grid-cols-2 gap-2">
            {(["CAREGIVER", "PATIENT"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  role === r
                    ? "border-champagne bg-champagne/15 text-champagne-soft"
                    : "border-white/12 text-cream/70 hover:border-white/30"
                }`}
              >
                {r === "CAREGIVER" ? t("auth.roleCaregiver") : t("auth.rolePatient")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{t("auth.name")}</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn-gold w-full" disabled={busy}>
          {busy ? t("common.loading") : t("auth.signUp")}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-cream/60">
        {t("auth.haveAccount")}{" "}
        <Link href="/signin" className="text-champagne hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
