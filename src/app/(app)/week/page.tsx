"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { displayStatus } from "@/lib/doseStatus";
import type { Dose } from "@/lib/types";

const DOT: Record<string, string> = {
  taken: "bg-emerald-300",
  skipped: "bg-white/30",
  due: "bg-champagne",
  upcoming: "bg-white/25",
  missed: "bg-red-400",
};

export default function WeekPage() {
  const { t, locale } = useI18n();
  const { patientId } = usePatient();
  const [days, setDays] = useState<string[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [tz, setTz] = useState<string>("UTC");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/doses/range?patientId=${patientId}&days=7`
      );
      const data = await res.json();
      setDays(data.days || []);
      setDoses(data.doses || []);
      if (data.tz) setTz(data.tz);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const loc = locale === "es" ? "es" : "en";

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString(loc, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
  }
  function dayHeader(ymd: string) {
    // Noon UTC then format in patient tz to get a stable weekday label.
    const d = new Date(ymd + "T12:00:00Z");
    return d.toLocaleDateString(loc, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: tz,
    });
  }
  function isToday(ymd: string) {
    const t = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return t === ymd;
  }

  // Group doses by their calendar day (in the patient timezone).
  function dosesForDay(ymd: string): Dose[] {
    return doses
      .filter((dose) => {
        const key = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(dose.scheduledFor));
        return key === ymd;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl text-cream">{t("week.title")}</h1>
        <p className="mt-1 text-cream/60">{t("week.subtitle")}</p>
      </header>

      {loading ? (
        <p className="text-cream/50">{t("common.loading")}</p>
      ) : doses.length === 0 ? (
        <div className="card p-10 text-center text-cream/60">{t("week.none")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((ymd) => {
            const list = dosesForDay(ymd);
            return (
              <div
                key={ymd}
                className={`card p-4 ${
                  isToday(ymd) ? "border-champagne/50" : ""
                }`}
              >
                <h3 className="mb-3 text-sm font-semibold capitalize text-champagne-soft">
                  {dayHeader(ymd)}
                </h3>
                {list.length === 0 ? (
                  <p className="text-xs text-cream/40">—</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((dose) => {
                      const st = displayStatus(
                        dose.status,
                        new Date(dose.scheduledFor)
                      );
                      return (
                        <li key={dose.id} className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${DOT[st]}`}
                          />
                          <span className="w-14 shrink-0 text-xs tabular-nums text-cream/50">
                            {fmtTime(dose.scheduledFor)}
                          </span>
                          <span className="truncate text-sm text-cream/85">
                            {dose.medication.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
