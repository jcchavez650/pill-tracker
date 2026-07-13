import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { resolvePatientId } from "@/lib/access";
import { materializeDoses, startOfDay, endOfDay } from "@/lib/dose";

// GET /api/doses/today?patientId=...&date=YYYY-MM-DD
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const patientId = await resolvePatientId(user, searchParams.get("patientId"));
  if (!patientId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const dateParam = searchParams.get("date");
  const day = dateParam ? new Date(dateParam + "T12:00:00") : new Date();

  await materializeDoses(patientId, day);

  const doses = await prisma.doseLog.findMany({
    where: {
      patientId,
      scheduledFor: { gte: startOfDay(day), lte: endOfDay(day) },
    },
    include: {
      medication: true,
      confirmationPhoto: true,
    },
    orderBy: { scheduledFor: "asc" },
  });

  return NextResponse.json({ doses });
}
