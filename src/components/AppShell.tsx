"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PatientProvider, usePatient } from "@/components/PatientContext";
import { NotificationsBell } from "@/components/NotificationsBell";
import type { TranslationKey } from "@/lib/i18n";

type NavItem = {
  href: string;
  key: TranslationKey;
  shortKey?: TranslationKey; // compact label for the mobile bar
  icon: string;
  caregiverOnly?: boolean;
};

// Primary tabs — the daily-use surfaces shown in the mobile bottom bar.
const PRIMARY_NAV: NavItem[] = [
  { href: "/today", key: "nav.today", icon: "☀️" },
  { href: "/tomorrow", key: "nav.tomorrow", icon: "🌙" },
  { href: "/week", key: "nav.week", icon: "📆" },
  { href: "/identify", key: "nav.identify", shortKey: "nav.identifyShort", icon: "🔍" },
  { href: "/settings", key: "nav.settings", icon: "⚙️" },
];

// Management surfaces — reached from the Settings hub (and the desktop sidebar).
const MANAGE_NAV: NavItem[] = [
  { href: "/schedule", key: "nav.schedule", icon: "🗓️" },
  { href: "/reports", key: "nav.reports", icon: "📊" },
  { href: "/patients", key: "nav.patients", icon: "👥", caregiverOnly: true },
];

const MANAGE_HREFS = MANAGE_NAV.map((n) => n.href);

function PatientSelector() {
  const { isCaregiver, patients, patientId, setPatientId, selfId } = usePatient();
  const { t } = useI18n();
  if (!isCaregiver || patients.length === 0) return null;
  return (
    <select
      value={patientId ?? selfId}
      onChange={(e) => setPatientId(e.target.value)}
      className="max-w-[36vw] truncate rounded-full border border-white/15 bg-ink-muted/70 px-3 py-2 text-sm text-cream outline-none focus:border-champagne/60 sm:max-w-none sm:px-4"
      aria-label={t("reports.patient")}
    >
      <option value={selfId}>{t("patients.myself")}</option>
      {patients.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function Chrome({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { isCaregiver } = usePatient();

  const primary = PRIMARY_NAV;
  const manage = MANAGE_NAV.filter((n) => !n.caregiverOnly || isCaregiver);

  // On a management page, keep the Settings tab highlighted in the bottom bar.
  function isActive(href: string) {
    if (href === "/settings")
      return pathname === "/settings" || MANAGE_HREFS.includes(pathname);
    return pathname === href;
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/today" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-sheen text-lg shadow-gold">
              💊
            </span>
            <span className="display hidden text-lg tracking-wide text-champagne-soft sm:block">
              {t("app.name")}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <PatientSelector />
            <NotificationsBell />
            <LanguageToggle />
            <button
              onClick={signOut}
              className="hidden rounded-full border border-white/15 px-4 py-2 text-xs text-cream/70 transition hover:text-cream sm:inline-block"
            >
              {t("nav.signout")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar nav (desktop) */}
        <nav className="sticky top-20 hidden h-fit w-52 shrink-0 flex-col gap-1 md:flex">
          <p className="px-3 pb-2 text-xs text-cream/40">{userName}</p>
          {primary
            .filter((n) => n.href !== "/settings")
            .map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} t={t} />
            ))}

          <p className="mt-3 px-3 pb-1 text-[10px] uppercase tracking-widest text-cream/30">
            {t("settings.manage")}
          </p>
          {manage.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} t={t} />
          ))}
          <SidebarLink
            item={{ href: "/settings", key: "nav.settings", icon: "⚙️" }}
            active={pathname === "/settings"}
            t={t}
          />

          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-cream/50 transition hover:text-cream"
          >
            <span aria-hidden>🚪</span>
            {t("nav.signout")}
          </button>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 pb-28 md:pb-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {primary.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition active:scale-95 ${
                  active ? "text-champagne-soft" : "text-cream/55"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xl ${
                    active ? "bg-champagne/15" : ""
                  }`}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span className="text-[11px] font-medium leading-none">
                  {t(item.shortKey ?? item.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  t,
}: {
  item: NavItem;
  active: boolean;
  t: (k: TranslationKey) => string;
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
        active
          ? "bg-champagne/15 text-champagne-soft"
          : "text-cream/70 hover:bg-white/5 hover:text-cream"
      }`}
    >
      <span aria-hidden>{item.icon}</span>
      {t(item.key)}
    </Link>
  );
}

export function AppShell({
  selfId,
  userName,
  isCaregiver,
  timezone,
  children,
}: {
  selfId: string;
  userName: string;
  isCaregiver: boolean;
  timezone: string;
  children: React.ReactNode;
}) {
  // Register the service worker for PWA + push once.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Auto-detect the device timezone and apply it where it's still unset:
  // the current user (if on default UTC) and, for caregivers, any managed
  // patient still on UTC. Refresh once if that corrected any schedules.
  useEffect(() => {
    let detected = "UTC";
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {}
    if (!detected || detected === "UTC") return;

    const selfNeedsSet = !timezone || timezone === "UTC";
    // Nothing to do for a non-caregiver whose timezone is already set.
    if (!isCaregiver && !selfNeedsSet) return;

    fetch("/api/settings/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: detected, includeSelf: selfNeedsSet }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.changed > 0 && !sessionStorage.getItem("pt_tz_fixed")) {
          sessionStorage.setItem("pt_tz_fixed", "1");
          window.location.reload();
        }
      })
      .catch(() => {});
  }, [timezone, isCaregiver]);

  // Apply the saved large-text preference.
  useEffect(() => {
    try {
      if (localStorage.getItem("pt_textsize") === "large") {
        document.documentElement.classList.add("text-large");
      }
    } catch {}
  }, []);

  return (
    <PatientProvider selfId={selfId} selfName={userName} isCaregiver={isCaregiver}>
      <Chrome userName={userName}>{children}</Chrome>
    </PatientProvider>
  );
}
