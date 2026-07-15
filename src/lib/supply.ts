import { prisma } from "./prisma";
import { sendPushToUser } from "./push";

/**
 * Decrement a medication's pill supply by one dose's worth. If supply is not
 * tracked (supplyCount === null) this is a no-op. When the remaining count
 * first drops to/below the threshold, notify the patient and their caregiver
 * (once — until supply is refilled/reset).
 */
export async function consumeSupply(medicationId: string): Promise<void> {
  const med = await prisma.medication.findUnique({
    where: { id: medicationId },
    select: {
      id: true,
      name: true,
      patientId: true,
      quantityPerDose: true,
      supplyCount: true,
      supplyThreshold: true,
      lowSupplyNotified: true,
    },
  });
  if (!med || med.supplyCount === null) return; // not tracked

  const newCount = Math.max(0, med.supplyCount - (med.quantityPerDose || 1));
  const threshold = med.supplyThreshold ?? 0;
  const crossed = !med.lowSupplyNotified && newCount <= threshold;

  await prisma.medication.update({
    where: { id: med.id },
    data: { supplyCount: newCount, ...(crossed ? { lowSupplyNotified: true } : {}) },
  });

  if (!crossed) return;

  const patient = await prisma.user.findUnique({
    where: { id: med.patientId },
    select: { caregiverId: true, name: true },
  });
  const targets = [med.patientId, patient?.caregiverId].filter(
    (x): x is string => Boolean(x)
  );
  for (const uid of targets) {
    await prisma.notification.create({
      data: {
        userId: uid,
        type: "lowsupply",
        title: `Low supply: ${med.name}`,
        body: `${newCount} left — time to refill.`,
      },
    });
    await sendPushToUser(uid, {
      title: `Low supply — ${med.name}`,
      body: `${newCount} pills left. Time to refill ${med.name}.`,
      url: "/schedule",
    });
  }
}
