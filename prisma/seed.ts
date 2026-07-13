import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const caregiver = await prisma.user.upsert({
    where: { email: "caregiver@example.com" },
    update: {},
    create: {
      email: "caregiver@example.com",
      name: "Maria (Caregiver)",
      passwordHash: password,
      role: "CAREGIVER",
      locale: "en",
    },
  });

  const patient = await prisma.user.upsert({
    where: { email: "mom@example.com" },
    update: {},
    create: {
      email: "mom@example.com",
      name: "Mom",
      passwordHash: password,
      role: "PATIENT",
      locale: "es",
      caregiverId: caregiver.id,
    },
  });

  const existing = await prisma.medication.count({
    where: { patientId: patient.id },
  });
  if (existing === 0) {
    await prisma.medication.create({
      data: {
        name: "Lisinopril",
        strength: "10 mg",
        form: "tablet",
        color: "white",
        shape: "round",
        instructions: "Take with water",
        patientId: patient.id,
        createdById: caregiver.id,
        times: { create: [{ time: "08:00" }, { time: "20:00" }] },
      },
    });
    await prisma.medication.create({
      data: {
        name: "Metformin",
        strength: "500 mg",
        form: "tablet",
        color: "white",
        shape: "oval",
        instructions: "Take with food",
        patientId: patient.id,
        createdById: caregiver.id,
        times: { create: [{ time: "12:00" }] },
      },
    });
  }

  console.log("Seeded:");
  console.log("  Caregiver → caregiver@example.com / password123");
  console.log("  Patient   → mom@example.com / password123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
