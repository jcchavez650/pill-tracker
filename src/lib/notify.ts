import { prisma } from "./prisma";
import { sendPushToUser } from "./push";

async function deliver(
  userId: string,
  type: string,
  title: string,
  body: string,
  url: string
) {
  await prisma.notification.create({ data: { userId, type, title, body } });
  await sendPushToUser(userId, { title, body, url });
}

/**
 * Send a medication alert to the person it's for, plus — if that patient has
 * opted their caregiver in (notifyCaregiver) — an oversight copy to the
 * caregiver, prefixed with the patient's name so they know who it's about.
 */
export async function notifyForMedication(
  patientId: string,
  opts: { type: string; title: string; body: string; url: string }
): Promise<void> {
  const patient = await prisma.user.findUnique({
    where: { id: patientId },
    select: { name: true, caregiverId: true, notifyCaregiver: true },
  });
  if (!patient) return;

  await deliver(patientId, opts.type, opts.title, opts.body, opts.url);

  if (patient.notifyCaregiver && patient.caregiverId) {
    await deliver(
      patient.caregiverId,
      opts.type,
      `${patient.name}: ${opts.title}`,
      opts.body,
      opts.url
    );
  }
}
