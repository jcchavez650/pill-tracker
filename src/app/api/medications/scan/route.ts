import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractRx } from "@/lib/anthropic";
import type { Locale } from "@/lib/i18n";

// POST /api/medications/scan — read a prescription photo and return structured
// fields to prefill the medication form. Body: { photo: dataUrl, locale? }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const locale: Locale = body.locale === "es" ? "es" : "en";

  if (typeof body.photo !== "string" || !body.photo.startsWith("data:")) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
  }

  try {
    const fields = await extractRx(body.photo, locale);
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "SCAN_FAILED" }, { status: 500 });
  }
}
