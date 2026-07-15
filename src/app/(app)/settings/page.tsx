"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { isCaregiver, patientId, selfId } = usePatient();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  // Timezone
  const [tz, setTz] = useState("UTC");
  const [tzSaved, setTzSaved] = useState(false);

  // Larger text
  const [textLarge, setTextLarge] = useState(false);

  // Change password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {}
    try {
      setTextLarge(localStorage.getItem("pt_textsize") === "large");
    } catch {}
  }, []);

  async function saveTimezone(next: string) {
    setTz(next);
    setTzSaved(false);
    // Caregivers viewing a specific patient set that patient's timezone too.
    const forPatient =
      isCaregiver && patientId && patientId !== selfId ? patientId : undefined;
    const res = await fetch("/api/settings/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: next, patientId: forPatient }),
    });
    if (res.ok) {
      setTzSaved(true);
      // Reflect the corrected schedule immediately.
      setTimeout(() => window.location.reload(), 400);
    }
  }

  function toggleTextSize() {
    const next = !textLarge;
    setTextLarge(next);
    try {
      localStorage.setItem("pt_textsize", next ? "large" : "normal");
    } catch {}
    document.documentElement.classList.toggle("text-large", next);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    if (res.ok) {
      setPwMsg({ ok: true, text: t("settings.passwordChanged") });
      setCurPw("");
      setNewPw("");
    } else if (res.status === 401) {
      setPwMsg({ ok: false, text: t("settings.wrongPassword") });
    } else {
      setPwMsg({ ok: false, text: t("auth.error") });
    }
  }

  const COMMON_TZ = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Mexico_City",
    "America/Bogota",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Paris",
    "UTC",
  ];
  const tzOptions = COMMON_TZ.includes(tz) ? COMMON_TZ : [tz, ...COMMON_TZ];

  async function enableNotifications() {
    setBusy(true);
    setStatus("");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      if (!VAPID_PUBLIC_KEY) {
        setStatus(
          locale === "es"
            ? "Falta la clave VAPID pública. Agrega NEXT_PUBLIC_VAPID_PUBLIC_KEY."
            : "Missing public VAPID key. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY."
        );
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        ) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setStatus(t("settings.notificationsOn"));
    } catch {
      setStatus(t("auth.error"));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="display text-4xl text-cream">{t("settings.title")}</h1>
      </header>

      {/* Language */}
      <section className="card p-6">
        <h2 className="mb-4 text-sm uppercase tracking-widest text-champagne/70">
          {t("settings.language")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setLocale("en")}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              locale === "en"
                ? "border-champagne bg-champagne/15 text-champagne-soft"
                : "border-white/12 text-cream/70"
            }`}
          >
            {t("settings.english")}
          </button>
          <button
            onClick={() => setLocale("es")}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              locale === "es"
                ? "border-champagne bg-champagne/15 text-champagne-soft"
                : "border-white/12 text-cream/70"
            }`}
          >
            {t("settings.spanish")}
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="card p-6">
        <h2 className="mb-4 text-sm uppercase tracking-widest text-champagne/70">
          {t("settings.notifications")}
        </h2>

        {permission === "unsupported" ? (
          <p className="text-sm text-cream/50">—</p>
        ) : permission === "denied" ? (
          <p className="text-sm text-red-300">{t("settings.notificationsBlocked")}</p>
        ) : permission === "granted" ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-200">{t("settings.notificationsOn")}</p>
            <button className="btn-ghost" onClick={enableNotifications} disabled={busy}>
              {t("settings.enableNotifications")}
            </button>
            <button className="btn-gold ml-2" onClick={sendTest}>
              {t("settings.testNotification")}
            </button>
          </div>
        ) : (
          <button className="btn-gold" onClick={enableNotifications} disabled={busy}>
            {busy ? t("common.loading") : t("settings.enableNotifications")}
          </button>
        )}
        {status && <p className="mt-3 text-sm text-cream/70">{status}</p>}
      </section>

      {/* Time zone */}
      <section className="card p-6">
        <h2 className="mb-2 text-sm uppercase tracking-widest text-champagne/70">
          {t("settings.timezone")}
        </h2>
        <p className="mb-4 text-xs text-cream/50">{t("settings.timezoneHint")}</p>
        <select
          value={tz}
          onChange={(e) => saveTimezone(e.target.value)}
          className="input"
        >
          {tzOptions.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {tzSaved && (
          <p className="mt-2 text-sm text-emerald-200">✓ {t("common.save")}</p>
        )}
      </section>

      {/* Larger text */}
      <section className="card flex items-center justify-between p-6">
        <div className="pr-4">
          <h2 className="text-sm uppercase tracking-widest text-champagne/70">
            {t("settings.textSize")}
          </h2>
          <p className="mt-1 text-xs text-cream/50">{t("settings.textSizeHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={textLarge}
          onClick={toggleTextSize}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${
            textLarge ? "bg-gold-sheen" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-ink transition-all ${
              textLarge ? "left-7" : "left-1"
            }`}
          />
        </button>
      </section>

      {/* Change password */}
      <section className="card p-6">
        <h2 className="mb-4 text-sm uppercase tracking-widest text-champagne/70">
          {t("settings.changePassword")}
        </h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">{t("settings.currentPassword")}</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{t("settings.newPassword")}</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? "text-emerald-200" : "text-red-300"}`}>
              {pwMsg.text}
            </p>
          )}
          <button className="btn-gold" disabled={!curPw || newPw.length < 6}>
            {t("settings.changePassword")}
          </button>
        </form>
      </section>
    </div>
  );
}
