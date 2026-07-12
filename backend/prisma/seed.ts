import bcrypt from "bcrypt";
import { ApplicationStatus, CohortStatus, UserRole } from "@prisma/client";
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

    const passwordHash = await bcrypt.hash("password123", 10);

    const admin = await tx.user.create({
      data: {
        email: "admin@academy.com",
        password_hash: passwordHash,
        full_name: "Alekseev Aleksei Alekseevich",
        role: UserRole.ADMIN,
      },
    });

    const student = await tx.user.create({
      data: {
        email: "student@test.com",
        password_hash: passwordHash,
        full_name: "Ivanov Ivan Ivanovich",
        role: UserRole.STUDENT,
      },
    });

    const currentYear = new Date().getFullYear();
    const cohort = await tx.cohort.create({
      data: {
        title: `Summer Practice ${currentYear}`,
        status: CohortStatus.ACTIVE,
        application_start: new Date(`${currentYear}-06-01`),
        application_end: new Date(`${currentYear}-06-30`),
        practice_start: new Date(`${currentYear}-07-01`),
        practice_end: new Date(`${currentYear}-08-31`),
        created_by: admin.id,
      },
    });

    const backendTrack = await tx.track.create({
      data: {
        title: "Backend Node.js / TypeScript",
        cohort_id: cohort.id,
      },
    });

    await tx.track.create({
      data: {
        title: "Frontend React / TypeScript",
        cohort_id: cohort.id,
      },
    });

    await tx.application.create({
      data: {
        user_id: student.id,
        track_id: backendTrack.id,
        status: ApplicationStatus.PENDING,
        rejection_reason: null,
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
