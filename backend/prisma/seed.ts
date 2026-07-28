import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/shared/prisma";

async function main() {
  await prisma.$transaction(async (tx) => {
    console.log("Controlled Reset...");

    await tx.dailyTaskLink.deleteMany();
    await tx.dailyTask.deleteMany();
    await tx.documentFieldValue.deleteMany();
    await tx.document.deleteMany();
    await tx.report.deleteMany();
    await tx.testTaskSubmission.deleteMany();
    await tx.applicationAnswer.deleteMany();
    await tx.application.deleteMany();
    await tx.testTask.deleteMany();
    await tx.track.deleteMany();
    await tx.question.deleteMany();
    await tx.survey.deleteMany();
    await tx.invitation.deleteMany();
    await tx.cohort.deleteMany();
    await tx.user.deleteMany();

    const passwordHash = await bcrypt.hash("mnG-h75-SxP-9LK", 10);

    await tx.user.create({
      data: {
        email: "anton@unocode.ru",
        password_hash: passwordHash,
        full_name: "Езуб Антон Сергеевич",
        role: UserRole.ADMIN,
      },
    });

    console.log("Seed completed successfully.");
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
