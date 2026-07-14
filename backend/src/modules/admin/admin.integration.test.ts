import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  ApplicationStatus,
  CohortStatus,
  DocumentType,
  PrismaClient,
  ReportStatus,
  UserRole,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AdminService } from "./admin.service";

const describeIntegration =
  process.env.RUN_DB_INTEGRATION === "true"
    ? describe
    : describe.skip;

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  }),
});

const service = new AdminService();
const ids = {
  users: [] as string[],
  cohorts: [] as string[],
  tracks: [] as string[],
  applications: [] as string[],
};

let cohortId: string;
let otherCohortId: string;
let trackId: string;
let applicationId: string;

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

describeIntegration("B-05 admin PostgreSQL integration", () => {
  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    const admin = await db.user.create({
      data: {
        email: `b05-admin-${suffix}@test.local`,
        password_hash: "test",
        full_name: "B05 Admin",
        role: UserRole.ADMIN,
      },
    });
    ids.users.push(admin.id);
    const student = await db.user.create({
      data: {
        email: `b05-student-${suffix}@test.local`,
        password_hash: "test",
        full_name: "B05 Student",
        role: UserRole.STUDENT,
      },
    });
    ids.users.push(student.id);
    const otherStudent = await db.user.create({
      data: {
        email: `b05-other-${suffix}@test.local`,
        password_hash: "test",
        full_name: "Other Cohort Student",
        role: UserRole.STUDENT,
      },
    });
    ids.users.push(otherStudent.id);

    const cohort = await db.cohort.create({
      data: {
        title: `B05 cohort ${suffix}`,
        status: CohortStatus.ACTIVE,
        practice_start: date("2026-07-01"),
        practice_end: date("2026-07-31"),
        created_by: admin.id,
      },
    });
    ids.cohorts.push(cohort.id);
    const otherCohort = await db.cohort.create({
      data: {
        title: `B05 other cohort ${suffix}`,
        status: CohortStatus.ACTIVE,
        practice_start: date("2026-07-01"),
        practice_end: date("2026-07-31"),
        created_by: admin.id,
      },
    });
    cohortId = cohort.id;
    otherCohortId = otherCohort.id;
    ids.cohorts.push(otherCohort.id);

    const track = await db.track.create({
      data: { title: "Backend", cohort_id: cohort.id },
    });
    ids.tracks.push(track.id);
    const otherTrack = await db.track.create({
      data: { title: "Frontend", cohort_id: otherCohort.id },
    });
    trackId = track.id;
    ids.tracks.push(otherTrack.id);

    const application = await db.application.create({
      data: {
        user_id: student.id,
        track_id: track.id,
        status: ApplicationStatus.APPROVED,
      },
    });
    ids.applications.push(application.id);
    const otherApplication = await db.application.create({
      data: {
        user_id: otherStudent.id,
        track_id: otherTrack.id,
        status: ApplicationStatus.APPROVED,
      },
    });
    applicationId = application.id;
    ids.applications.push(otherApplication.id);

    await Promise.all([
      db.report.create({
        data: {
          application_id: application.id,
          file_url: `reports/${suffix}.pdf`,
          status: ReportStatus.APPROVED,
          reviewed_at: new Date(),
        },
      }),
      db.document.create({
        data: {
          application_id: application.id,
          type: DocumentType.NOTICE,
          fieldValues: {
            create: {
              field_key: "student_fio",
              value: "B05 Student",
              filled_by: UserRole.STUDENT,
            },
          },
        },
      }),
      db.dailyTask.create({
        data: {
          application_id: application.id,
          task_date: date("2026-07-01"),
          description: null,
        },
      }),
    ]);
  });

  afterAll(async () => {
    if (ids.applications.length > 0) {
      await db.application.deleteMany({
        where: { id: { in: ids.applications } },
      });
    }
    if (ids.tracks.length > 0) {
      await db.track.deleteMany({
        where: { id: { in: ids.tracks } },
      });
    }
    if (ids.cohorts.length > 0) {
      await db.cohort.deleteMany({
        where: { id: { in: ids.cohorts } },
      });
    }
    if (ids.users.length > 0) {
      await db.user.deleteMany({
        where: { id: { in: ids.users } },
      });
    }
    await db.$disconnect();
  });

  it("filters applications and never crosses the cohort boundary", async () => {
    const applications = await service.getApplications(cohortId, {
      status: ApplicationStatus.APPROVED,
      trackId,
      search: "B05 Student",
    });

    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      applicationId,
      track: { id: trackId },
      report: { status: ReportStatus.APPROVED },
      missedDays: 1,
    });
  });

  it("returns four readiness indicators and scoped EAV values", async () => {
    const applications = await service.getDocuments(cohortId, {
      reportStatus: ReportStatus.APPROVED,
      readiness: "INCOMPLETE",
    });
    const detail = await service.getApplicationDocuments(
      cohortId,
      applicationId
    );

    expect(applications).toHaveLength(1);
    expect(applications[0].documents).toHaveLength(4);
    expect(detail.fieldValues).toEqual([
      {
        type: DocumentType.NOTICE,
        values: [
          {
            key: "student_fio",
            value: "B05 Student",
            filledBy: UserRole.STUDENT,
          },
        ],
      },
    ]);
  });

  it("returns 404 for a resource requested through another cohort", async () => {
    await expect(
      service.getApplicationDocuments(otherCohortId, applicationId)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "APPLICATION_NOT_FOUND",
    });
  });
});
