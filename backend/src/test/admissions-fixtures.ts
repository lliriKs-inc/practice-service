import bcrypt from "bcrypt";
import { CohortStatus, FieldType, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { LocalStorageService } from "../shared/storage";
import { config } from "../shared/config";

export interface AdmissionsFixture {
  prefix: string;
  adminId: string;
  adminEmail: string;
  adminPassword: string;
  cohortId: string;
  trackId: string;
  secondTrackId: string | null;
  invitationToken: string;
  surveyId: string;
  questionId: string;
  foreignCohortId: string;
  foreignTrackId: string;
}

export async function createAdmissionsFixture(
  options: { includeSecondTrack?: boolean } = {},
): Promise<AdmissionsFixture> {
  const prefix = `a07-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminEmail = `${prefix}-admin@example.com`;
  const adminPassword = "A07-Admin-password-123!";
  const passwordHash = await bcrypt.hash(adminPassword, 4);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password_hash: passwordHash,
      full_name: "A-07 Test Admin",
      role: UserRole.ADMIN,
    },
  });

  const now = new Date();
  const practiceEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const cohort = await prisma.cohort.create({
    data: {
      title: `${prefix} cohort`,
      status: CohortStatus.ACTIVE,
      application_start: new Date(now.getTime() - 60 * 60 * 1000),
      application_end: new Date(now.getTime() + 60 * 60 * 1000),
      practice_start: now,
      practice_end: practiceEnd,
      created_by: admin.id,
    },
  });
  const survey = await prisma.survey.create({
    data: { cohort_id: cohort.id, title: `${prefix} survey` },
  });
  const question = await prisma.question.create({
    data: {
      survey_id: survey.id,
      label: "Why do you want to join?",
      type: FieldType.TEXTAREA,
      order_index: 0,
      required: true,
      options: Prisma.JsonNull,
    },
  });
  const track = await prisma.track.create({
    data: { cohort_id: cohort.id, title: `${prefix} Backend` },
  });
  const secondTrack = options.includeSecondTrack
    ? await prisma.track.create({
        data: { cohort_id: cohort.id, title: `${prefix} Frontend` },
      })
    : null;
  const invitation = await prisma.invitation.create({
    data: {
      cohort_id: cohort.id,
      token: `${prefix}-invitation`,
      expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
  });
  await prisma.testTask.create({
    data: {
      track_id: track.id,
      title: `${prefix} test task`,
      description: "Implement the requested feature.",
      published_at: now,
    },
  });
  if (secondTrack) {
    await prisma.testTask.create({
      data: {
        track_id: secondTrack.id,
        title: `${prefix} second test task`,
        description: "Implement the alternative track task.",
        published_at: now,
      },
    });
  }

  const foreignCohort = await prisma.cohort.create({
    data: {
      title: `${prefix} foreign cohort`,
      status: CohortStatus.DRAFT,
      practice_start: now,
      practice_end: practiceEnd,
      created_by: admin.id,
    },
  });
  const foreignTrack = await prisma.track.create({
    data: { cohort_id: foreignCohort.id, title: `${prefix} Foreign` },
  });

  return {
    prefix,
    adminId: admin.id,
    adminEmail,
    adminPassword,
    cohortId: cohort.id,
    trackId: track.id,
    secondTrackId: secondTrack?.id ?? null,
    invitationToken: invitation.token,
    surveyId: survey.id,
    questionId: question.id,
    foreignCohortId: foreignCohort.id,
    foreignTrackId: foreignTrack.id,
  };
}

export async function cleanupAdmissionsFixture(
  fixture: AdmissionsFixture,
  extraUserIds: string[] = [],
) {
  const storage = new LocalStorageService({ rootDirectory: config.storage.uploadDir });
  const applications = await prisma.application.findMany({
    where: {
      OR: [
        { track_id: fixture.trackId },
        ...(fixture.secondTrackId ? [{ track_id: fixture.secondTrackId }] : []),
        { track_id: fixture.foreignTrackId },
        ...(extraUserIds.length > 0 ? [{ user_id: { in: extraUserIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const applicationIds = applications.map(({ id }) => id);
  const storedSubmissions = applicationIds.length > 0
    ? await prisma.testTaskSubmission.findMany({
        where: { application_id: { in: applicationIds } },
        select: { file_url: true },
      })
    : [];
  const storedReports = applicationIds.length > 0
    ? await prisma.report.findMany({
        where: { application_id: { in: applicationIds } },
        select: { file_url: true },
      })
    : [];
  const storedDocuments = applicationIds.length > 0
    ? await prisma.document.findMany({
        where: { application_id: { in: applicationIds } },
        select: { generated_file_url: true },
      })
    : [];

  if (applicationIds.length > 0) {
    await prisma.dailyTaskLink.deleteMany({ where: { dailyTask: { application_id: { in: applicationIds } } } });
    await prisma.dailyTask.deleteMany({ where: { application_id: { in: applicationIds } } });
    await prisma.testTaskSubmission.deleteMany({ where: { application_id: { in: applicationIds } } });
    await prisma.applicationAnswer.deleteMany({ where: { application_id: { in: applicationIds } } });
    await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  }

  await Promise.all(storedSubmissions.map(({ file_url }) => storage.remove(file_url).catch(() => undefined)));
  await Promise.all(storedReports.map(({ file_url }) => storage.remove(file_url).catch(() => undefined)));
  await Promise.all(
    storedDocuments
      .map(({ generated_file_url }) => generated_file_url)
      .filter((fileUrl): fileUrl is string => Boolean(fileUrl))
      .map((fileUrl) => storage.remove(fileUrl).catch(() => undefined)),
  );

  const trackIds = [fixture.trackId, fixture.secondTrackId, fixture.foreignTrackId]
    .filter((trackId): trackId is string => Boolean(trackId));
  await prisma.testTask.deleteMany({ where: { track_id: { in: trackIds } } });
  await prisma.invitation.deleteMany({ where: { cohort_id: fixture.cohortId } });
  await prisma.question.deleteMany({ where: { survey_id: fixture.surveyId } });
  await prisma.survey.deleteMany({ where: { id: fixture.surveyId } });
  await prisma.track.deleteMany({ where: { id: { in: trackIds } } });
  await prisma.cohort.deleteMany({ where: { id: { in: [fixture.cohortId, fixture.foreignCohortId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.adminId, ...extraUserIds] } } });
}
