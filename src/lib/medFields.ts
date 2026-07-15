// Shared parsing/sanitizing for medication scheduling + supply fields,
// used by the create and update medication routes.

export function cleanTimes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set((v as unknown[]).map(String).filter((t) => /^\d{2}:\d{2}$/.test(t))),
  ].sort();
}

/** CSV of weekday numbers 0(Sun)..6(Sat). null = every day. */
export function sanitizeDaysOfWeek(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const days = [
    ...new Set(
      (v as unknown[])
        .map((n) => parseInt(String(n), 10))
        .filter((n) => n >= 0 && n <= 6)
    ),
  ].sort((a, b) => a - b);
  // Empty or all-seven means "every day" → store null.
  if (days.length === 0 || days.length === 7) return null;
  return days.join(",");
}

/** Non-negative integer, or null if not a usable number. */
export function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

/** Parse an optional ISO date; returns Date, null (explicit clear), or undefined (leave). */
export function optionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
