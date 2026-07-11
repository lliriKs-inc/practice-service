import bcrypt from "bcrypt";
import {
  UserRole,
  CohortStatus,
  ApplicationStatus,
} from "@prisma/client";
import { prisma } from "../src/shared/prisma";

async function main() {
  console.log('🚀 Controlled Reset...');

  // Очистка в порядке зависимостей
  await prisma.dailyTaskLink.deleteMany();
  await prisma.dailyTask.deleteMany();
  await prisma.documentFieldValue.deleteMany();
  await prisma.document.deleteMany();
  await prisma.report.deleteMany();
  await prisma.testTaskSubmission.deleteMany();
  await prisma.applicationAnswer.deleteMany();
  await prisma.application.deleteMany();
  await prisma.testTask.deleteMany();
  await prisma.track.deleteMany();
  await prisma.question.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  console.log('👤 Создаем пользователей...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@academy.com',
      password_hash: passwordHash,
      full_name: 'Алексеев Алексей Алексеевич',
      role: UserRole.ADMIN,
    },
  });

  const student = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password_hash: passwordHash,
      full_name: 'Иванов Иван Иванович',
      role: UserRole.STUDENT,
    },
  });

  console.log('📅 Создаем когорту...');

  const currentYear = new Date().getFullYear();

  const cohort = await prisma.cohort.create({
    data: {
      title: `Летняя практика ${currentYear}`,
      status: CohortStatus.ACTIVE,
      application_start: new Date(`${currentYear}-06-01`),
      application_end: new Date(`${currentYear}-06-30`),
      practice_start: new Date(`${currentYear}-07-01`),
      practice_end: new Date(`${currentYear}-08-31`),
      created_by: admin.id,
    },
  });

  console.log('🎯 Создаем треки...');

  const backendTrack = await prisma.track.create({
    data: {
      title: 'Backend Node.js / TypeScript',
      cohort_id: cohort.id,
    },
  });

  await prisma.track.create({
    data: {
      title: 'Frontend React / TypeScript',
      cohort_id: cohort.id,
    },
  });

  console.log('📝 Создаем заявку...');

  await prisma.application.create({
    data: {
      user_id: student.id,
      track_id: backendTrack.id,
      status: ApplicationStatus.PENDING,
      rejection_reason: null,
    },
  });

  console.log('✅ Seed успешно выполнен.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });