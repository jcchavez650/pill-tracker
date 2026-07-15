// Timezone-aware date helpers so schedules follow the patient's local wall
// clock rather than the server's timezone (UTC on Railway).
//
// We avoid extra dependencies by using Intl to compute a timezone's offset at
// a given instant. This is accurate except for the ~1 ambiguous hour around a
// DST transition, which is acceptable for medication reminders.

/** Offset in ms to add to a UTC instant to get wall-clock time in `tz`. */
function tzOffsetMs(instant: Date, tz: string): number {
  // Format the instant as if it were in `tz`, then read it back as if UTC.
  const asString = instant.toLocaleString("en-US", { timeZone: tz });
  const asIfUtc = new Date(asString + " UTC");
  return asIfUtc.getTime() - instant.getTime();
}

/**
 * The UTC Date for a wall-clock time (Y-M-D H:M) in `tz`.
 * e.g. zonedTimeToUtc(2026,7,15,8,0,"America/New_York") -> 2026-07-15T12:00:00Z
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Offset at that approximate instant, then correct.
  const offset = tzOffsetMs(new Date(guessUtc), tz);
  return new Date(guessUtc - offset);
}

/** The calendar Y/M/D (and weekday) in `tz` for a given instant. */
export function zonedYMD(
  instant: Date,
  tz: string
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/** Parse a "YYYY-MM-DD" string. */
export function parseYMD(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  return { year: y, month: m, day: d };
}

/** Weekday (0=Sun..6=Sat) for a calendar date in `tz`. */
export function weekdayForYMD(
  year: number,
  month: number,
  day: number,
  tz: string
): number {
  // Noon avoids DST edge issues when determining the weekday.
  const noon = zonedTimeToUtc(year, month, day, 12, 0, tz);
  return zonedYMD(noon, tz).weekday;
}

/** UTC start/end instants for a calendar day (YMD) in `tz`. */
export function dayRangeInTz(
  ymd: string,
  tz: string
): { start: Date; end: Date } {
  const { year, month, day } = parseYMD(ymd);
  const start = zonedTimeToUtc(year, month, day, 0, 0, tz);
  // End = start of next day minus 1ms.
  const nextGuess = new Date(start.getTime() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000);
  const ny = zonedYMD(nextGuess, tz);
  const nextStart = zonedTimeToUtc(ny.year, ny.month, ny.day, 0, 0, tz);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

/** Today's calendar date (YYYY-MM-DD) in `tz`. */
export function todayYMD(tz: string, offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const { year, month, day } = zonedYMD(now, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Is `tz` a valid IANA timezone the runtime understands? */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
