import bcrypt from "bcrypt";
import { prisma } from "../src/shared/prisma";

async function main() {
  const adminHash = await bcrypt.hash("123456", 10);
  const studentHash = await bcrypt.hash("12345678", 10);

  const cohort = await prisma.cohort.upsert({
    where: { name: "Practice 2026 Demo" },
    update: {},
    create: {
      name: "Practice 2026 Demo",
      application_start: new Date("2026-07-01T00:00:00.000Z"),
      application_end: new Date("2026-07-31T23:59:59.000Z"),
      practice_start: new Date("2026-08-01T00:00:00.000Z"),
      practice_end: new Date("2026-08-31T23:59:59.000Z"),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: { password_hash: adminHash, role: "ADMIN", active_cohort_id: cohort.id },
    create: { email: "admin@test.com", password_hash: adminHash, role: "ADMIN", active_cohort_id: cohort.id },
  });

  const student = await prisma.user.upsert({
    where: { email: "student-e2e@test.com" },
    update: { password_hash: studentHash, role: "STUDENT", active_cohort_id: cohort.id },
    create: { email: "student-e2e@test.com", password_hash: studentHash, role: "STUDENT", active_cohort_id: cohort.id },
  });

  const role = await prisma.cohortRole.upsert({
    where: { cohort_id_name: { cohort_id: cohort.id, name: "Backend" } },
    update: {},
    create: { cohort_id: cohort.id, name: "Backend" },
  });

  const surveyField =
    (await prisma.surveyField.findFirst({ where: { cohort_id: cohort.id, order: 1 } })) ??
    (await prisma.surveyField.create({
      data: { cohort_id: cohort.id, label: "FIO", type: "TEXT", order: 1 },
    }));

  const application = await prisma.application.upsert({
    where: { user_id_cohort_id: { user_id: student.id, cohort_id: cohort.id } },
    update: { status: "APPROVED", role_id: role.id, review_comment: null },
    create: { user_id: student.id, cohort_id: cohort.id, role_id: role.id, status: "APPROVED" },
  });

  await prisma.applicationAnswer.upsert({
    where: { application_id_field_id: { application_id: application.id, field_id: surveyField.id } },
    update: { value: "Ivanov Ivan Ivanovich" },
    create: { application_id: application.id, field_id: surveyField.id, value: "Ivanov Ivan Ivanovich" },
  });

  await prisma.studentDocumentData.upsert({
    where: { user_id_cohort_id: { user_id: student.id, cohort_id: cohort.id } },
    update: {
      student_fio: "Ivanov Ivan Ivanovich",
      group: "RI-330948",
      direction_code: "09.03.04",
      direction_name: "Software Engineering",
      program_name: "Software and Information Systems Development",
      specialty: "09.03.04 Software Engineering",
      practice_topic: "Development of an internship management service",
      main_stage_tasks: "Configure backend API; integrate document modules; verify trainee task cards",
      review_activities: "The student participated in backend module development and verification.",
      review_characteristic: "The student showed confident TypeScript, Express and REST API skills.",
      review_employed: "No",
      review_next_practice: "Yes",
      review_employment_offer: "Possible after graduation",
      review_suggestions: "Continue improving integration testing skills.",
      review_grade: "Excellent",
      report_file_url: "/uploads/demo-report.docx",
      report_admin_approved: true,
    },
    create: {
      user_id: student.id,
      cohort_id: cohort.id,
      student_fio: "Ivanov Ivan Ivanovich",
      group: "RI-330948",
      direction_code: "09.03.04",
      direction_name: "Software Engineering",
      program_name: "Software and Information Systems Development",
      specialty: "09.03.04 Software Engineering",
      practice_topic: "Development of an internship management service",
      main_stage_tasks: "Configure backend API; integrate document modules; verify trainee task cards",
      report_file_url: "/uploads/demo-report.docx",
      report_admin_approved: true,
    },
  });

  const existingTask = await prisma.taskCard.findFirst({
    where: { user_id: student.id, cohort_id: cohort.id, title: "E2E Tasks API verification" },
  });

  if (!existingTask) {
    await prisma.taskCard.create({
      data: {
        user_id: student.id,
        cohort_id: cohort.id,
        date: new Date("2026-08-03T00:00:00.000Z"),
        title: "E2E Tasks API verification",
        description: "Task creation, listing, weekly filtering and update work correctly.",
        artifact_link: "https://github.com/example/pr/tasks-e2e",
      },
    });
  }

  console.log("DEMO DATA CREATED");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
