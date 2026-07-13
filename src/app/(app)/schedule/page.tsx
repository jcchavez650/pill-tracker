"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Modal } from "@/components/Modal";
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
                    {m.times.map((tm) => (
                      <span
                        key={tm.id}
                        className="chip border border-champagne/30 bg-champagne/10 text-champagne-soft"
                      >
                        {tm.time}
                      </span>
                    ))}
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
  const { t } = useI18n();
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
        }
      : emptyForm
  );
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.name.trim() || form.times.length === 0) return;
    setBusy(true);
    try {
      const payload = {
        ...form,
        patientId,
        referencePhoto: form.referencePhoto || undefined,
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

  return (
    <Modal
      open
      onClose={onClose}
      title={medication ? t("med.editTitle") : t("med.addTitle")}
    >
      <div className="space-y-4">
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
