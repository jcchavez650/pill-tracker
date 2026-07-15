"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { BackToSettings } from "@/components/BackToSettings";
import type { Dose } from "@/lib/types";

type ReportData = {
  counts: { TAKEN: number; MISSED: number; SKIPPED: number; PENDING: number };
  adherence: number | null;
  range: number;
  doses: Dose[];
  tz: string;
};

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { patientId } = usePatient();
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports?range=${range}&patientId=${patientId}`
      );
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [patientId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const statCards = data
    ? [
        { key: "reports.taken", value: data.counts.TAKEN, cls: "text-emerald-200" },
        { key: "reports.missed", value: data.counts.MISSED, cls: "text-red-200" },
        { key: "reports.skipped", value: data.counts.SKIPPED, cls: "text-cream/60" },
        { key: "reports.pending", value: data.counts.PENDING, cls: "text-champagne-soft" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <BackToSettings />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl text-cream">{t("reports.title")}</h1>
          <p className="mt-1 text-cream/60">{t("reports.subtitle")}</p>
        </div>
        <div className="inline-flex rounded-full border border-white/15 bg-ink-muted/60 p-0.5 text-xs font-semibold">
          <button
            onClick={() => setRange(7)}
            className={`rounded-full px-4 py-2 transition ${
              range === 7 ? "bg-gold-sheen text-ink" : "text-cream/70"
            }`}
          >
            {t("reports.last7")}
          </button>
          <button
            onClick={() => setRange(30)}
            className={`rounded-full px-4 py-2 transition ${
              range === 30 ? "bg-gold-sheen text-ink" : "text-cream/70"
            }`}
          >
            {t("reports.last30")}
          </button>
        </div>
      </header>

      {loading || !data ? (
        <p className="text-cream/50">{t("common.loading")}</p>
      ) : (
        <>
          {/* Adherence hero */}
          <div className="card flex flex-col items-center gap-4 p-8 sm:flex-row sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-champagne/70">
                {t("reports.rate")}
              </p>
              <p className="display mt-1 text-6xl text-cream">
                {data.adherence === null ? "—" : `${data.adherence}%`}
              </p>
            </div>
            <AdherenceRing value={data.adherence} />
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.key} className="card p-5 text-center">
                <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-cream/50">
                  {t(s.key as never)}
                </p>
              </div>
            ))}
          </div>

          {/* History */}
          <section className="space-y-3">
            <h2 className="display text-xl text-cream/80">{t("reports.history")}</h2>
            {data.doses.length === 0 ? (
              <p className="text-cream/50">{t("reports.noData")}</p>
            ) : (
              <div className="card divide-y divide-white/5">
                {data.doses.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-4">
                    {d.confirmationPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.confirmationPhoto.url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-muted text-lg">
                        💊
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-cream">
                        {d.medication.name}
                      </p>
                      <p className="text-xs text-cream/50">
                        {new Date(d.scheduledFor).toLocaleString(
                          locale === "es" ? "es" : "en",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: data.tz,
                          }
                        )}
                      </p>
                    </div>
                    <StatusPill status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Dose["status"] }) {
  const { t } = useI18n();
  const map: Record<Dose["status"], { key: string; cls: string }> = {
    TAKEN: { key: "reports.taken", cls: "bg-emerald-mid/25 text-emerald-100" },
    MISSED: { key: "reports.missed", cls: "bg-red-500/15 text-red-200" },
    SKIPPED: { key: "reports.skipped", cls: "bg-white/5 text-cream/50" },
    PENDING: { key: "reports.pending", cls: "bg-champagne/15 text-champagne-soft" },
  };
  const s = map[status];
  return <span className={`chip ${s.cls}`}>{t(s.key as never)}</span>;
}

function AdherenceRing({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="12"
      />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="url(#goldgrad)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <defs>
        <linearGradient id="goldgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e7cf9f" />
          <stop offset="100%" stopColor="#b8934f" />
        </linearGradient>
      </defs>
      <text
        x="70"
        y="78"
        textAnchor="middle"
        className="fill-cream"
        style={{ fontSize: 24, fontWeight: 700 }}
      >
        {value === null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}
