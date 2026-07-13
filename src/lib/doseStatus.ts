// Pure, client-safe dose status helpers (no server/DB imports).
import type { DoseStatus } from "@prisma/client";

/** A dose is considered "due" within this window before its scheduled time. */
export const DUE_WINDOW_MS = 60 * 60 * 1000; // 1 hour early
/** After this long past scheduled time, a still-pending dose reads as missed. */
export const MISSED_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours late

export type DisplayStatus = "taken" | "skipped" | "due" | "upcoming" | "missed";

export function displayStatus(
  status: DoseStatus,
  scheduledFor: Date,
  now: Date = new Date()
): DisplayStatus {
  if (status === "TAKEN") return "taken";
  if (status === "SKIPPED") return "skipped";
  if (status === "MISSED") return "missed";
  const diff = scheduledFor.getTime() - now.getTime();
  if (diff > DUE_WINDOW_MS) return "upcoming";
  if (now.getTime() - scheduledFor.getTime() > MISSED_AFTER_MS) return "missed";
  return "due";
}
