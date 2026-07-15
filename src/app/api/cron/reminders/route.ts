import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { materializeDoses } from "@/lib/dose";
import { sendPushToUser } from "@/lib/push";
import { translate } from "@/lib/i18n";
import { todayYMD } from "@/lib/tz";
import type { Locale } from "@/lib/i18n";

/**
 * Reminder cron. Call this every ~5 minutes from a scheduler
 * (Vercel Cron, GitHub Actions, cron-job.org, etc.):
 *   GET /api/cron/reminders  with header  Authorization: Bearer <CRON_SECRET>
 *
 * It:
 *   1. Materializes today's doses for every patient.
 *   2. Sends a push reminder for any dose due right now (within a 5-min window)
 *      that is still pending, to the patient and their caregiver.
 *   3. Flips long-overdue pending doses to MISSED and alerts the caregiver.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
    }
  }

  const now = new Date();
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT" },
    select: {
      id: true,
      name: true,
      locale: true,
      caregiverId: true,
      timezone: true,
    },
  });

  let reminders = 0;
  let missed = 0;

  for (const patient of patients) {
    const tz = patient.timezone || "UTC";
    // Materialize today's doses in the patient's timezone (covers tz where the
    // local day differs from the server's UTC day).
    await materializeDoses(patient.id, todayYMD(tz), tz);
    const locale: Locale = patient.locale === "es" ? "es" : "en";

    // Doses due within the last/next 5 minutes, still pending.
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);

    const due = await prisma.doseLog.findMany({
      where: {
        patientId: patient.id,
        status: "PENDING",
        scheduledFor: { gte: windowStart, lte: windowEnd },
      },
      include: { medication: true },
    });

    for (const dose of due) {
      await sendPushToUser(patient.id, {
        title: translate(locale, "notif.reminderTitle"),
        body: translate(locale, "notif.reminderBody", {
          med: dose.medication.name,
        }),
        url: "/today",
        tag: `dose-${dose.id}`,
      });
      await prisma.notification.create({
        data: {
          userId: patient.id,
          type: "reminder",
          title: translate(locale, "notif.reminderTitle"),
          body: translate(locale, "notif.reminderBody", {
            med: dose.medication.name,
          }),
        },
      });
      reminders++;
    }

    // Mark long-overdue (>2h) pending doses as missed and alert caregiver.
    const overdue = await prisma.doseLog.findMany({
      where: {
        patientId: patient.id,
        status: "PENDING",
        scheduledFor: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      },
      include: { medication: true },
    });

    for (const dose of overdue) {
      await prisma.doseLog.update({
        where: { id: dose.id },
        data: { status: "MISSED" },
      });
      missed++;
      if (patient.caregiverId) {
        await prisma.notification.create({
          data: {
            userId: patient.caregiverId,
            type: "missed",
            title: `Missed dose: ${dose.medication.name}`,
            body: `${patient.name} missed ${dose.medication.name}.`,
          },
        });
        await sendPushToUser(patient.caregiverId, {
          title: `Missed dose — ${patient.name}`,
          body: `${dose.medication.name} was not taken.`,
          url: "/reports",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, reminders, missed });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
