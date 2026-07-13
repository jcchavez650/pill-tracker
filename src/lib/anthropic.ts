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
