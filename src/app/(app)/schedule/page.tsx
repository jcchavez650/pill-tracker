"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Modal } from "@/components/Modal";
import { BackToSettings } from "@/components/BackToSettings";
import type { Medication } from "@/lib/types";

type FormState = {
  name: string;
  strength: string;
  form: string;
  instructions: string;
  color: string;
  shape: string;
  imprint: string;
  times: string[];
  referencePhoto: string | null;
  asNeeded: boolean;
  daysOfWeek: number[]; // empty = every day
  quantityPerDose: string;
  supplyCount: string;
  supplyThreshold: string;
  startDate: string;
  endDate: string;
};

const emptyForm: FormState = {
  name: "",
  strength: "",
  form: "",
  instructions: "",
  color: "",
  shape: "",
  imprint: "",
  times: ["08:00"],
  referencePhoto: null,
  asNeeded: false,
  daysOfWeek: [],
  quantityPerDose: "1",
  supplyCount: "",
  supplyThreshold: "10",
  startDate: "",
  endDate: "",
};

export default function SchedulePage() {
  const { t } = useI18n();
  const { patientId } = usePatient();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/medications?patientId=${patientId}`);
      const data = await res.json();
      setMeds(data.medications || []);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/medications/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <BackToSettings />
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl text-cream">{t("nav.schedule")}</h1>
          <p className="mt-1 text-cream/60">{t("today.subtitle")}</p>
        </div>
        <button className="btn-gold" onClick={() => setCreating(true)}>
          + {t("common.add")}
        </button>
      </header>

      {loading ? (
        <p className="text-cream/50">{t("common.loading")}</p>
      ) : meds.length === 0 ? (
        <div className="card p-10 text-center text-cream/60">{t("med.none")}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {meds.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink-muted">
                  {m.referencePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.referencePhotoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">💊</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-cream">
                    {m.name}{" "}
                    {m.strength && (
                      <span className="text-sm font-normal text-cream/50">
                        {m.strength}
                      </span>
                    )}
                  </h3>
                  {m.instructions && (
                    <p className="text-sm text-cream/60">{m.instructions}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.asNeeded ? (
                      <span className="chip border border-white/15 bg-white/5 text-cream/70">
                        {t("med.asNeeded")}
                      </span>
                    ) : (
                      m.times.map((tm) => (
                        <span
                          key={tm.id}
                          className="chip border border-champagne/30 bg-champagne/10 text-champagne-soft"
                        >
                          {tm.time}
                        </span>
                      ))
                    )}
                    {!m.asNeeded && m.daysOfWeek && (
                      <span className="chip border border-white/15 bg-white/5 text-cream/60">
                        {m.daysOfWeek
                          .split(",")
                          .map((d) => t(`day.${parseInt(d, 10)}` as never))
                          .join(" ")}
                      </span>
                    )}
                    {m.supplyCount != null && (
                      <span
                        className={`chip border ${
                          m.supplyThreshold != null &&
                          m.supplyCount <= m.supplyThreshold
                            ? "border-red-400/40 bg-red-500/15 text-red-200"
                            : "border-emerald-mid/40 bg-emerald-mid/10 text-emerald-100"
                        }`}
                      >
                        {t("med.left", { n: m.supplyCount })}
                        {m.supplyThreshold != null &&
                          m.supplyCount <= m.supplyThreshold &&
                          ` · ${t("med.lowSupply")}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-ghost flex-1 !py-2 text-xs" onClick={() => setEditing(m)}>
                  {t("common.edit")}
                </button>
                <button
                  className="btn-quiet !py-2 text-xs text-red-300/80 hover:text-red-200"
                  onClick={() => remove(m.id)}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <MedForm
          patientId={patientId!}
          medication={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MedForm({
  patientId,
  medication,
  onClose,
  onSaved,
}: {
  patientId: string;
  medication: Medication | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<FormState>(
    medication
      ? {
          name: medication.name,
          strength: medication.strength || "",
          form: medication.form || "",
          instructions: medication.instructions || "",
          color: medication.color || "",
          shape: medication.shape || "",
          imprint: medication.imprint || "",
          times: medication.times.map((x) => x.time),
          referencePhoto: null,
          asNeeded: medication.asNeeded,
          daysOfWeek: medication.daysOfWeek
            ? medication.daysOfWeek
                .split(",")
                .map((n) => parseInt(n, 10))
                .filter((n) => !Number.isNaN(n))
            : [],
          quantityPerDose: String(medication.quantityPerDose ?? 1),
          supplyCount:
            medication.supplyCount != null ? String(medication.supplyCount) : "",
          supplyThreshold:
            medication.supplyThreshold != null
              ? String(medication.supplyThreshold)
              : "",
          startDate: medication.startDate
            ? medication.startDate.slice(0, 10)
            : "",
          endDate: medication.endDate ? medication.endDate.slice(0, 10) : "",
        }
      : emptyForm
  );
  const [busy, setBusy] = useState(false);
  const [rxPhoto, setRxPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function scanRx() {
    if (!rxPhoto) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch("/api/medications/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: rxPhoto, locale }),
      });
      const data = await res.json();
      const f = data.fields;
      if (!res.ok || !f || f.notFound) {
        setScanMsg({ ok: false, text: t("med.scanFailed") });
        return;
      }
      // Merge what the AI found into the form (keep existing values otherwise).
      const merged: FormState = {
        ...form,
        name: f.name || form.name,
        strength: f.strength || form.strength,
        form: f.form || form.form,
        instructions: f.instructions || form.instructions,
        color: f.color || form.color,
        shape: f.shape || form.shape,
        imprint: f.imprint || form.imprint,
        times:
          Array.isArray(f.times) && f.times.length > 0 ? f.times : form.times,
      };
      setForm(merged);

      // Prefill the form for review — the caregiver confirms/edits before the
      // schedule is created (review-before-create).
      setScanMsg({
        ok: true,
        text:
          merged.name.trim() && merged.times.length === 0
            ? t("med.scanNeedTimes")
            : t("med.scanReview"),
      });
    } catch {
      setScanMsg({ ok: false, text: t("med.scanFailed") });
    } finally {
      setScanning(false);
    }
  }

  async function persist(data: FormState) {
    setBusy(true);
    try {
      const payload = {
        ...data,
        patientId,
        referencePhoto: data.referencePhoto || undefined,
      };
      const url = medication
        ? `/api/medications/${medication.id}`
        : "/api/medications";
      await fetch(url, {
        method: medication ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form.name.trim()) return;
    if (!form.asNeeded && form.times.length === 0) return;
    await persist(form);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={medication ? t("med.editTitle") : t("med.addTitle")}
    >
      <div className="space-y-4">
        {/* AI prescription scan */}
        <div className="rounded-2xl border border-champagne/25 bg-champagne/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span aria-hidden>✨</span>
            <h3 className="text-sm font-semibold text-champagne-soft">
              {t("med.scanTitle")}
            </h3>
          </div>
          <p className="mb-3 text-xs text-cream/60">{t("med.scanHint")}</p>
          <PhotoCapture
            value={rxPhoto}
            onChange={(v) => {
              setRxPhoto(v);
              setScanMsg(null);
            }}
            label={t("med.scanTitle")}
          />
          {rxPhoto && (
            <button
              type="button"
              className="btn-gold mt-3 w-full"
              disabled={scanning}
              onClick={scanRx}
            >
              {scanning ? t("med.scanning") : t("med.scanButton")}
            </button>
          )}
          {scanMsg && (
            <p
              className={`mt-3 text-sm ${
                scanMsg.ok ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {scanMsg.ok ? "✓ " : "⚠️ "}
              {scanMsg.text}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wider text-cream/40">
            {t("med.orManually")}
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div>
          <label className="label">{t("med.name")}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("med.strength")}</label>
            <input
              className="input"
              placeholder="10 mg"
              value={form.strength}
              onChange={(e) => set("strength", e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("med.form")}</label>
            <input
              className="input"
              value={form.form}
              onChange={(e) => set("form", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">{t("med.instructions")}</label>
          <input
            className="input"
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{t("med.color")}</label>
            <input
              className="input !px-3"
              value={form.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("med.shape")}</label>
            <input
              className="input !px-3"
              value={form.shape}
              onChange={(e) => set("shape", e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("med.imprint")}</label>
            <input
              className="input !px-3"
              value={form.imprint}
              onChange={(e) => set("imprint", e.target.value)}
            />
          </div>
        </div>

        {/* As needed (PRN) toggle */}
        <label className="flex items-start gap-3 rounded-2xl border border-white/12 p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-champagne"
            checked={form.asNeeded}
            onChange={(e) => set("asNeeded", e.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-cream">
              {t("med.asNeeded")}
            </span>
            <span className="block text-xs text-cream/50">
              {t("med.asNeededHint")}
            </span>
          </span>
        </label>

        {!form.asNeeded && (
          <>
            <div>
              <label className="label">{t("med.times")}</label>
              <div className="space-y-2">
                {form.times.map((time, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="time"
                      className="input"
                      value={time}
                      onChange={(e) => {
                        const next = [...form.times];
                        next[i] = e.target.value;
                        set("times", next);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-quiet !px-3 text-red-300/70"
                      onClick={() =>
                        set(
                          "times",
                          form.times.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-ghost !py-2 text-xs"
                  onClick={() => set("times", [...form.times, "12:00"])}
                >
                  + {t("med.addTime")}
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div>
              <label className="label">{t("med.days")}</label>
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const on =
                    form.daysOfWeek.length === 0 || form.daysOfWeek.includes(d);
                  const everyDay = form.daysOfWeek.length === 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        // Starting from "every day", first tap selects just that day.
                        let next = everyDay ? [] : [...form.daysOfWeek];
                        if (everyDay) next = [d];
                        else if (next.includes(d))
                          next = next.filter((x) => x !== d);
                        else next.push(d);
                        set("daysOfWeek", next);
                      }}
                      className={`h-9 w-11 rounded-xl text-xs font-medium transition ${
                        on && !everyDay
                          ? "bg-champagne/20 text-champagne-soft"
                          : everyDay
                          ? "bg-white/5 text-cream/60"
                          : "bg-white/5 text-cream/40"
                      }`}
                    >
                      {t(`day.${d}` as never)}
                    </button>
                  );
                })}
              </div>
              {form.daysOfWeek.length === 0 && (
                <p className="mt-1 text-xs text-cream/40">{t("med.everyDay")}</p>
              )}
            </div>
          </>
        )}

        {/* Supply tracking */}
        <div>
          <label className="label">{t("med.supplyTitle")}</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="mb-1 block text-[10px] text-cream/45">
                {t("med.supplyCount")}
              </span>
              <input
                type="number"
                min={0}
                className="input !px-3"
                value={form.supplyCount}
                onChange={(e) => set("supplyCount", e.target.value)}
              />
            </div>
            <div>
              <span className="mb-1 block text-[10px] text-cream/45">
                {t("med.quantityPerDose")}
              </span>
              <input
                type="number"
                min={1}
                className="input !px-3"
                value={form.quantityPerDose}
                onChange={(e) => set("quantityPerDose", e.target.value)}
              />
            </div>
            <div>
              <span className="mb-1 block text-[10px] text-cream/45">
                {t("med.supplyThreshold")}
              </span>
              <input
                type="number"
                min={0}
                className="input !px-3"
                value={form.supplyThreshold}
                onChange={(e) => set("supplyThreshold", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Start / end dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("med.startDate")}</label>
            <input
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              {t("med.endDate")}{" "}
              <span className="lowercase text-cream/40">
                ({t("common.optional")})
              </span>
            </label>
            <input
              type="date"
              className="input"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">
            {t("med.referencePhoto")}{" "}
            <span className="lowercase text-cream/40">({t("common.optional")})</span>
          </label>
          <p className="mb-2 text-xs text-cream/50">{t("med.referencePhotoHint")}</p>
          {medication?.referencePhotoUrl && !form.referencePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={medication.referencePhotoUrl}
              alt=""
              className="mb-2 h-24 w-24 rounded-2xl object-cover"
            />
          )}
          <PhotoCapture
            value={form.referencePhoto}
            onChange={(v) => set("referencePhoto", v)}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-gold flex-1" disabled={busy} onClick={save}>
            {busy ? t("common.loading") : t("common.save")}
          </button>
          <button className="btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
