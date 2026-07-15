// Shared client-side shapes returned by the API (subset of Prisma models).

export type Medication = {
  id: string;
  name: string;
  strength: string | null;
  form: string | null;
  instructions: string | null;
  color: string | null;
  shape: string | null;
  imprint: string | null;
  referencePhotoUrl: string | null;
  active: boolean;
  asNeeded: boolean;
  daysOfWeek: string | null;
  quantityPerDose: number;
  supplyCount: number | null;
  supplyThreshold: number | null;
  startDate?: string;
  endDate?: string | null;
  times: { id: string; time: string }[];
};

export type Photo = { id: string; url: string };

export type Dose = {
  id: string;
  scheduledFor: string;
  status: "PENDING" | "TAKEN" | "MISSED" | "SKIPPED";
  takenAt: string | null;
  prepped?: boolean;
  aiVerdict: "UNVERIFIED" | "MATCH" | "MISMATCH" | "UNSURE";
  aiConfidence: number | null;
  aiNotes: string | null;
  medication: Medication;
  confirmationPhoto: Photo | null;
};
