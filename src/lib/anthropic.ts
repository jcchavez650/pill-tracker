import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** Split a data URL ("data:image/jpeg;base64,....") into media type + data. */
export function parseDataUrl(
  dataUrl: string
): { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string } | null {
  const match = /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    mediaType: match[1] as "image/jpeg" | "image/png" | "image/webp",
    data: match[3],
  };
}

export type PillIdentification = {
  answer: string;
};

/** Free-form "what is this pill?" identification for the Identify feature. */
export async function identifyPill(
  imageDataUrl: string,
  question: string | undefined,
  locale: "en" | "es"
): Promise<PillIdentification> {
  const client = getClient();
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) throw new Error("INVALID_IMAGE");

  if (!client) {
    return {
      answer:
        locale === "es"
          ? "La identificación por IA no está configurada todavía (falta la clave de API de Anthropic). Agrega ANTHROPIC_API_KEY para activar esta función."
          : "AI identification isn't configured yet (missing Anthropic API key). Add ANTHROPIC_API_KEY to enable this feature.",
    };
  }

  const langInstruction =
    locale === "es"
      ? "Respond in Spanish."
      : "Respond in English.";

  const userText =
    (question?.trim()
      ? `The person asks: "${question.trim()}"\n\n`
      : "") +
    `Look at this photo of a pill/medication. Describe what you can observe: color, shape, size, any imprint or markings, and coating. If the imprint or appearance strongly matches a known medication, say which one it most likely is and typical uses, but be clear about uncertainty. ${langInstruction} Keep it clear and reassuring for a non-expert. Always end with a short reminder to confirm with a pharmacist or doctor before taking any medication.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: parsed.mediaType,
              data: parsed.data,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  const answer = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  return { answer };
}

export type RxExtraction = {
  name: string;
  strength: string;
  form: string;
  instructions: string;
  color: string;
  shape: string;
  imprint: string;
  times: string[]; // suggested "HH:MM" times inferred from the directions
  notFound: boolean; // true if no prescription could be read from the image
};

const EMPTY_RX: RxExtraction = {
  name: "",
  strength: "",
  form: "",
  instructions: "",
  color: "",
  shape: "",
  imprint: "",
  times: [],
  notFound: true,
};

/**
 * Read a prescription label / bottle / pill photo and extract structured
 * medication details to prefill the "Add medication" form.
 */
export async function extractRx(
  imageDataUrl: string,
  locale: "en" | "es"
): Promise<RxExtraction> {
  const client = getClient();
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) throw new Error("INVALID_IMAGE");
  if (!client) return { ...EMPTY_RX };

  const langInstruction =
    locale === "es"
      ? "Write the `instructions` value in Spanish."
      : "Write the `instructions` value in English.";

  const prompt = `You are reading a prescription. The image may be a pharmacy label, a medication bottle, a package, or the pill itself.

Extract what you can and respond with ONLY a JSON object (no markdown, no code fences) of this exact shape:
{
  "name": "<medication name, brand or generic>",
  "strength": "<e.g. 10 mg>",
  "form": "<tablet | capsule | liquid | etc.>",
  "instructions": "<the directions / sig, e.g. 'Take 1 tablet by mouth twice daily with food'>",
  "color": "<pill color if visible, else empty>",
  "shape": "<pill shape if visible, else empty>",
  "imprint": "<pill imprint/marking if visible, else empty>",
  "times": ["HH:MM", ...],
  "notFound": <true only if the image shows no readable medication information>
}

Rules:
- Use an empty string "" for any field you cannot determine. Do not guess.
- For "times": infer reasonable 24-hour clock times from the directions. Examples:
  "once daily"/"every morning" -> ["08:00"]; "twice daily" -> ["08:00","20:00"];
  "three times daily" -> ["08:00","14:00","20:00"]; "at bedtime" -> ["21:00"];
  "every 8 hours" -> ["06:00","14:00","22:00"]. If you cannot tell, use [].
- ${langInstruction}
- Respond with the JSON object only.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: parsed.mediaType,
              data: parsed.data,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  try {
    const jsonStr = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const p = JSON.parse(jsonStr) as Partial<RxExtraction>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const times = Array.isArray(p.times)
      ? [
          ...new Set(
            p.times
              .map((t) => str(t))
              .filter((t) => /^\d{2}:\d{2}$/.test(t))
          ),
        ].sort()
      : [];
    return {
      name: str(p.name),
      strength: str(p.strength),
      form: str(p.form),
      instructions: str(p.instructions),
      color: str(p.color),
      shape: str(p.shape),
      imprint: str(p.imprint),
      times,
      notFound: p.notFound === true || (!str(p.name) && times.length === 0),
    };
  } catch {
    return { ...EMPTY_RX };
  }
}

export type ConfirmationResult = {
  verdict: "MATCH" | "MISMATCH" | "UNSURE";
  confidence: number; // 0-100
  notes: string;
};

/**
 * Confirm that a photo of pills matches the expected medications for a dose.
 * `expected` describes each medication (name, strength, color, shape, imprint).
 */
export async function confirmDosePhoto(
  imageDataUrl: string,
  expected: Array<{
    name: string;
    strength?: string | null;
    color?: string | null;
    shape?: string | null;
    imprint?: string | null;
  }>,
  locale: "en" | "es"
): Promise<ConfirmationResult> {
  const client = getClient();
  const parsed = parseDataUrl(imageDataUrl);
  if (!parsed) throw new Error("INVALID_IMAGE");

  if (!client) {
    return {
      verdict: "UNSURE",
      confidence: 0,
      notes:
        locale === "es"
          ? "Verificación por IA no configurada. Foto guardada."
          : "AI verification not configured. Photo saved.",
    };
  }

  const expectedText = expected
    .map((m, i) => {
      const bits = [
        `#${i + 1} ${m.name}`,
        m.strength ? `strength ${m.strength}` : null,
        m.color ? `color ${m.color}` : null,
        m.shape ? `shape ${m.shape}` : null,
        m.imprint ? `imprint "${m.imprint}"` : null,
      ].filter(Boolean);
      return bits.join(", ");
    })
    .join("\n");

  const langInstruction =
    locale === "es" ? "Write the notes in Spanish." : "Write the notes in English.";

  const prompt = `You are helping verify that a patient is about to take the correct medication.

Expected pill(s) for this dose:
${expectedText}

Look at the photo. Compare the pill(s) visible against the expected list based on count, color, shape, and any visible imprint. ${langInstruction}

Respond with ONLY a JSON object (no markdown, no code fences) of this exact shape:
{"verdict": "MATCH" | "MISMATCH" | "UNSURE", "confidence": <integer 0-100>, "notes": "<one or two short sentences explaining what you see and any concern>"}

Use MATCH only if the visible pills reasonably correspond to what's expected. Use MISMATCH if something clearly differs (wrong color/shape/count). Use UNSURE if the photo is unclear or you cannot tell.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: parsed.mediaType,
              data: parsed.data,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  try {
    const jsonStr = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsedJson = JSON.parse(jsonStr) as ConfirmationResult;
    const verdict =
      parsedJson.verdict === "MATCH" ||
      parsedJson.verdict === "MISMATCH" ||
      parsedJson.verdict === "UNSURE"
        ? parsedJson.verdict
        : "UNSURE";
    const confidence = Math.max(
      0,
      Math.min(100, Math.round(Number(parsedJson.confidence) || 0))
    );
    return { verdict, confidence, notes: String(parsedJson.notes || "") };
  } catch {
    return { verdict: "UNSURE", confidence: 0, notes: raw.slice(0, 300) };
  }
}
