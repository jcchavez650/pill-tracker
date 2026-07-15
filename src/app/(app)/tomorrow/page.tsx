"use client";

import { DayDoses } from "@/components/DayDoses";

export default function TomorrowPage() {
  // Read-only preview of tomorrow's schedule.
  return <DayDoses dayOffset={1} interactive={false} />;
}
