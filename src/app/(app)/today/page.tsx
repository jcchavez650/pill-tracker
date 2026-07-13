"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Modal } from "@/components/Modal";
import { displayStatus, type DisplayStatus } from "@/lib/doseStatus";
import type { Dose } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";

const STATUS_STYLE: Record<DisplayStatus, string> = {
  taken: "bg-emerald-mid/25 text-emerald-100 border-emerald-mid/40",
  skipped: "bg-white/5 text-cream/50 border-white/10",
  due: "bg-champagne/20 text-champagne-soft border-champagne/40",
  upcoming: "bg-white/5 text-cream/60 border-white/10",
  missed: "bg-red-500/15 text-red-200 border-red-400/30",
};

const STATUS_KEY: Record<DisplayStatus, TranslationKey> = {
  taken: "today.taken",
  skipped: "reports.skipped",
  due: "today.due",
  upcoming: "today.upcoming",
  missed: "today.missed",
};

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 12) return "today.greetingMorning";
  if (h < 18) return "today.greetingAfternoon";
  return "today.greetingEvening";
}

export default function TodayPage() {
  const { t, locale } = useI18n();
  const { patientId } = usePatient();
  const [doses, setDoses] = useState<Dose[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Dose | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/doses/today?patientId=${patientId}`);
      const data = await res.json();
      setDoses(data.doses || []);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const allDone =
    doses.length > 0 &&
    doses.every((d) => d.status === "TAKEN" || d.status === "SKIPPED");

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString(locale === "es" ? "es" : "en", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl text-cream">{t(greetingKey())}</h1>
        <p className="mt-1 text-cream/60">{t("today.subtitle")}</p>
      </header>

      {loading ? (
        <p className="text-cream/50">{t("common.loading")}</p>
      ) : doses.length === 0 ? (
        <div className="card p-10 text-center text-cream/60">
          {t("today.nothing")}
        </div>
      ) : (
        <>
          {allDone && (
            <div className="card border-emerald-mid/40 bg-emerald-mid/10 p-6 text-center text-emerald-100">
              {t("today.allDone")}
            </div>
          )}
          <div className="space-y-3">
            {doses.map((dose) => {
              const st = displayStatus(
                dose.status,
                new Date(dose.scheduledFor)
              );
              const done = dose.status === "TAKEN" || dose.status === "SKIPPED";
              return (
                <div
                  key={dose.id}
                  className="card flex items-center gap-4 p-4 sm:p-5"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink-muted">
                    {dose.medication.referencePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dose.medication.referencePhotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">💊</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-cream">
                        {dose.medication.name}
                      </h3>
                      {dose.medication.strength && (
                        <span className="text-xs text-cream/50">
                          {dose.medication.strength}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-cream/55">
                      {fmtTime(dose.scheduledFor)}
                      {dose.medication.instructions
                        ? ` · ${dose.medication.instructions}`
                        : ""}
                    </p>
                    <span
                      className={`chip mt-1.5 border ${STATUS_STYLE[st]}`}
                    >
                      {t(STATUS_KEY[st])}
                      {dose.status === "TAKEN" &&
                        dose.aiVerdict === "MATCH" &&
                        " ✓"}
                      {dose.status === "TAKEN" &&
                        dose.aiVerdict === "MISMATCH" &&
                        " ⚠️"}
                    </span>
                  </div>

                  {!done && (
                    <button
                      onClick={() => setActive(dose)}
                      className="btn-gold shrink-0 !px-4 !py-2.5 text-xs sm:text-sm"
                    >
                      {t("today.take")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {active && (
        <ConfirmModal
          dose={active}
          locale={locale}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  dose,
  locale,
  onClose,
  onDone,
}: {
  dose: Dose;
  locale: "en" | "es";
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    verdict: string;
    confidence: number | null;
    notes: string;
  } | null>(null);

  async function submit(withPhoto: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/doses/${dose.id}/take`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: withPhoto ? photo : undefined, locale }),
      });
      const data = await res.json();
      if (withPhoto && data.dose) {
        setResult({
          verdict: data.dose.aiVerdict,
          confidence: data.dose.aiConfidence,
          notes: data.dose.aiNotes,
        });
        // Give the caregiver/patient a moment to read the verdict.
        setTimeout(onDone, 2600);
      } else {
        onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  const verdictMsg =
    result?.verdict === "MATCH"
      ? { text: t("today.verifiedMatch"), cls: "text-emerald-200" }
      : result?.verdict === "MISMATCH"
      ? { text: t("today.verifiedMismatch"), cls: "text-red-200" }
      : { text: t("today.verifiedUnsure"), cls: "text-champagne-soft" };

  return (
    <Modal open onClose={onClose} title={t("today.confirmTitle")}>
      <p className="mb-4 text-sm text-cream/60">{t("today.confirmInstruction")}</p>

      {result ? (
        <div className="space-y-3 text-center">
          <p className={`text-lg font-semibold ${verdictMsg.cls}`}>
            {verdictMsg.text}
          </p>
          {result.confidence != null && result.verdict !== "UNVERIFIED" && (
            <p className="text-sm text-cream/60">
              {t("today.confidence")}: {result.confidence}%
            </p>
          )}
          {result.notes && (
            <p className="text-sm text-cream/70">{result.notes}</p>
          )}
        </div>
      ) : busy ? (
        <p className="py-8 text-center text-cream/70">{t("today.verifying")}</p>
      ) : (
        <>
          <PhotoCapture value={photo} onChange={setPhoto} />
          <div className="mt-5 flex flex-col gap-2">
            <button
              className="btn-gold w-full"
              disabled={!photo}
              onClick={() => submit(true)}
            >
              {t("common.confirm")}
            </button>
            <button
              className="btn-quiet w-full"
              onClick={() => submit(false)}
            >
              {t("today.markTaken")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
