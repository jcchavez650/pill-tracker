"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { usePatient } from "@/components/PatientContext";
import { Modal } from "@/components/Modal";
import { BackToSettings } from "@/components/BackToSettings";

type PatientRow = {
  id: string;
  name: string;
  email: string;
  locale: string;
  _count: { medications: number };
};

export default function PatientsPage() {
  const { t } = useI18n();
  const { setPatientId, refreshPatients } = usePatient();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [resetPw, setResetPw] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/patients");
      const data = await res.json();
      setPatients(data.patients || []);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(id: string) {
    const res = await fetch(`/api/patients/${id}/password`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setResetPw((m) => ({ ...m, [id]: data.password }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <BackToSettings />
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl text-cream">{t("patients.title")}</h1>
          <p className="mt-1 text-cream/60">{t("patients.subtitle")}</p>
        </div>
        <button className="btn-gold" onClick={() => setAdding(true)}>
          + {t("patients.add")}
        </button>
      </header>

      {loading ? (
        <p className="text-cream/50">{t("common.loading")}</p>
      ) : patients.length === 0 ? (
        <div className="card p-10 text-center text-cream/60">
          {t("patients.none")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {patients.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-sheen text-lg font-bold text-ink">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cream">{p.name}</p>
                  <p className="truncate text-xs text-cream/50">{p.email}</p>
                  <p className="text-xs text-cream/40">
                    {p._count.medications} · {t("nav.schedule")}
                  </p>
                </div>
                <button
                  className="btn-ghost !py-2 text-xs"
                  onClick={() => {
                    setPatientId(p.id);
                    window.location.href = "/today";
                  }}
                >
                  {t("patients.view")}
                </button>
              </div>
              <div className="mt-3">
                {resetPw[p.id] ? (
                  <p className="rounded-xl bg-ink-muted/60 px-3 py-2 text-sm">
                    <span className="text-cream/50">
                      {t("patients.newCredentials")}{" "}
                    </span>
                    <span className="font-mono text-champagne-soft">
                      {resetPw[p.id]}
                    </span>
                  </p>
                ) : (
                  <button
                    className="btn-quiet !py-1.5 text-xs text-cream/60"
                    onClick={() => resetPassword(p.id)}
                  >
                    🔑 {t("patients.resetPassword")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddPatient
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
            await refreshPatients();
          }}
        />
      )}
    </div>
  );
}

function AddPatient({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    email: string;
    tempPassword?: string;
  } | null>(null);

  async function save() {
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, locale }),
      });
      if (res.status === 409) {
        setError(t("auth.emailTaken"));
        return;
      }
      if (!res.ok) {
        setError(t("auth.error"));
        return;
      }
      const data = await res.json();
      setCreated({ email: email.trim().toLowerCase(), tempPassword: data.tempPassword });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("patients.add")}>
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-cream/70">{t("patients.created")}</p>
          <div className="card space-y-2 p-4">
            <p className="text-sm">
              <span className="text-cream/50">{t("auth.email")}: </span>
              <span className="font-mono text-champagne-soft">{created.email}</span>
            </p>
            {created.tempPassword && (
              <p className="text-sm">
                <span className="text-cream/50">{t("patients.tempPassword")}: </span>
                <span className="font-mono text-champagne-soft">
                  {created.tempPassword}
                </span>
              </p>
            )}
          </div>
          <button className="btn-gold w-full" onClick={onSaved}>
            {t("common.close")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-cream/60">{t("patients.addSubtitle")}</p>
          <div>
            <label className="label">{t("auth.name")}</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">{t("auth.email")}</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              {t("auth.password")}{" "}
              <span className="lowercase text-cream/40">({t("common.optional")})</span>
            </label>
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-gold flex-1" disabled={busy} onClick={save}>
              {busy ? t("common.loading") : t("common.save")}
            </button>
            <button className="btn-ghost" onClick={onClose}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
