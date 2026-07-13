"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

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
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
  }, []);

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
    </div>
  );
}
