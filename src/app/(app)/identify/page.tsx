"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { PhotoCapture } from "@/components/PhotoCapture";

type Item = {
  id: string;
  question: string | null;
  aiAnswer: string | null;
  createdAt: string;
  photo: { url: string } | null;
};

export default function IdentifyPage() {
  const { t, locale } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [history, setHistory] = useState<Item[]>([]);

  async function loadHistory() {
    try {
      const res = await fetch("/api/identify");
      const data = await res.json();
      setHistory(data.items || []);
    } catch {}
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function analyze() {
    if (!photo) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, question, locale }),
      });
      const data = await res.json();
      setAnswer(data.item?.aiAnswer || "");
      setPhoto(null);
      setQuestion("");
      loadHistory();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl text-cream">{t("identify.title")}</h1>
        <p className="mt-1 max-w-xl text-cream/60">{t("identify.subtitle")}</p>
      </header>

      <div className="card space-y-4 p-6">
        <PhotoCapture
          value={photo}
          onChange={setPhoto}
          label={t("identify.takePhoto")}
        />
        <div>
          <label className="label">{t("identify.question")}</label>
          <input
            className="input"
            placeholder={t("identify.questionPlaceholder")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <button
          className="btn-gold w-full"
          disabled={!photo || busy}
          onClick={analyze}
        >
          {busy ? t("identify.analyzing") : t("identify.analyze")}
        </button>
      </div>

      {answer && (
        <div className="card space-y-3 border-champagne/30 p-6">
          <h2 className="display text-xl text-champagne-soft">
            {t("identify.result")}
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-cream/90">
            {answer}
          </p>
        </div>
      )}

      <p className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-amber-100/70">
        ⚠️ {t("identify.disclaimer")}
      </p>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="display text-xl text-cream/80">
            {t("identify.history")}
          </h2>
          {history.map((item) => (
            <div key={item.id} className="card flex gap-4 p-4">
              {item.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.photo.url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
              )}
              <div className="min-w-0">
                {item.question && (
                  <p className="text-sm font-medium text-cream">{item.question}</p>
                )}
                <p className="mt-1 line-clamp-4 text-xs text-cream/60">
                  {item.aiAnswer}
                </p>
                <p className="mt-1 text-[10px] text-cream/35">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
