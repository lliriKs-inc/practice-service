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
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DailyTaskProgressService } from "./daily-task-progress.service";
import { DailyTaskProgressReadService } from "./daily-task-progress-read.service";

const shouldRun =
  process.env.RUN_DB_INTEGRATION === "true";

const describeIntegration = shouldRun
  ? describe
  : describe.skip;

const connectionString =
  process.env.DATABASE_URL ?? "";

const adapter = new PrismaPg({
  connectionString,
});

const db = new PrismaClient({ adapter });

const writeService = new DailyTaskProgressService();
const readService = new DailyTaskProgressReadService();

let studentId: string;
let anotherStudentId: string;
let adminId: string;
let cohortId: string;
let otherCohortId: string;
let trackId: string;
let applicationId: string;
let taskId: string;

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

describeIntegration(
  "DailyTask progress PostgreSQL integration",
  () => {
    beforeAll(async () => {
      const student = await db.user.create({
        data: {
          email: `student-${Date.now()}@test.local`,
          password_hash: "test",
          full_name: "Test Student",
          role: UserRole.STUDENT,
        },
      });

      const anotherStudent = await db.user.create({
        data: {
          email: `another-${Date.now()}@test.local`,
          password_hash: "test",
          full_name: "Another Student",
          role: UserRole.STUDENT,
        },
      });

      const admin = await db.user.create({
        data: {
          email: `admin-${Date.now()}@test.local`,
          password_hash: "test",
          full_name: "Test Admin",
          role: UserRole.ADMIN,
        },
      });

      studentId = student.id;
      anotherStudentId = anotherStudent.id;
      adminId = admin.id;

      const cohort = await db.cohort.create({
        data: {
          title: "Integration Cohort",
          status: CohortStatus.ACTIVE,
          practice_start: date("2026-07-01"),
          practice_end: date("2026-07-31"),
          created_by: adminId,
        },
      });

      const otherCohort = await db.cohort.create({
        data: {
          title: "Other Cohort",
          status: CohortStatus.ACTIVE,
          practice_start: date("2026-07-01"),
          practice_end: date("2026-07-31"),
          created_by: adminId,
        },
      });

      cohortId = cohort.id;
      otherCohortId = otherCohort.id;

      const track = await db.track.create({
        data: {
          title: "Backend",
          cohort_id: cohortId,
        },
      });

      trackId = track.id;

      const application = await db.application.create({
        data: {
          user_id: studentId,
          track_id: trackId,
          status: ApplicationStatus.APPROVED,
        },
      });

      applicationId = application.id;

      const task = await db.dailyTask.create({
        data: {
          application_id: applicationId,
          task_date: date("2026-07-13"),
        },
      });

      taskId = task.id;
    });

    afterAll(async () => {
      await db.dailyTaskLink.deleteMany();
      await db.dailyTask.deleteMany();
      await db.application.deleteMany({
        where: {
          id: applicationId,
        },
      });
      await db.track.deleteMany({
        where: {
          id: trackId,
        },
      });
      await db.cohort.deleteMany({
        where: {
          id: {
            in: [cohortId, otherCohortId],
          },
        },
      });
      await db.user.deleteMany({
        where: {
          id: {
            in: [
              studentId,
              anotherStudentId,
              adminId,
            ],
          },
        },
      });

      await db.$disconnect();
    });

    it("updates description, replaces links and sets saved_at", async () => {
      const result = await writeService.updateMine(
        studentId,
        taskId,
        {
          description: "Integration result",
          links: [
            { url: "https://example.com/one" },
            { url: "https://example.com/two" },
          ],
        }
      );

      expect(result?.description).toBe(
        "Integration result"
      );
      expect(result?.saved_at).toBeInstanceOf(Date);
      expect(result?.links).toHaveLength(2);

      const secondResult =
        await writeService.updateMine(
          studentId,
          taskId,
          {
            description: "Replaced result",
            links: [
              { url: "https://example.com/replaced" },
            ],
          }
        );

      expect(secondResult?.description).toBe(
        "Replaced result"
      );
      expect(secondResult?.links).toHaveLength(1);
      expect(secondResult?.links[0].url).toBe(
        "https://example.com/replaced"
      );
    });

    it("prevents another student from editing the task", async () => {
      await expect(
        writeService.updateMine(
          anotherStudentId,
          taskId,
          {
            description: "Forbidden",
            links: [],
          }
        )
      ).rejects.toMatchObject({
        code: "DAILY_TASK_NOT_FOUND",
      });
    });

    it("returns only the user's own weekly progress", async () => {
      const result = await readService.getMine(
        studentId,
        applicationId,
        "2026-07-13"
      );

      expect(result.applicationId).toBe(
        applicationId
      );
      expect(result.days).toHaveLength(5);
      expect(
        result.days.some(
          (day) => day.date === "2026-07-13"
        )
      ).toBe(true);

      await expect(
        readService.getMine(
          anotherStudentId,
          applicationId,
          "2026-07-13"
        )
      ).rejects.toMatchObject({
        code: "APPLICATION_NOT_FOUND",
      });
    });

    it("returns missed tasks only up to today's UTC date", async () => {
      await db.dailyTask.create({
        data: {
          application_id: applicationId,
          task_date: date("2026-07-14"),
          description: null,
        },
      });

      const futureTask = await db.dailyTask.create({
        data: {
          application_id: applicationId,
          task_date: date("2099-01-05"),
          description: null,
        },
      });

      const result = await readService.getMissed(
        cohortId,
        "2026-07-13"
      );

      expect(
        result.missed.some(
          (item) => item.taskId === futureTask.id
        )
      ).toBe(false);

      expect(
        result.missed.every(
          (item) =>
            item.student.id === studentId
        )
      ).toBe(true);
    });
  }
);
