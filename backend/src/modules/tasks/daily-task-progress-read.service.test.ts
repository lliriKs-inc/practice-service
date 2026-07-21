import { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import { DailyTaskProgressReadService } from "./daily-task-progress-read.service";

const service = new DailyTaskProgressReadService();

describe("DailyTaskProgressReadService weekly boundaries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clips personal weekday cells and the task query to practice dates", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
      track: {
        id: "track-1",
        title: "Backend",
        cohort: {
          id: "cohort-1",
          title: "Summer",
          practice_start: new Date("2026-07-15T00:00:00.000Z"),
          practice_end: new Date("2026-07-16T00:00:00.000Z"),
        },
      },
    } as any);
    const findMany = vi
      .spyOn(prisma.dailyTask, "findMany")
      .mockResolvedValue([]);

    const result = await service.getMine(
      "student-1",
      "application-1",
      "2026-07-13"
    );

    expect(result.days.map((day) => day.date)).toEqual([
      "2026-07-15",
      "2026-07-16",
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          application_id: "application-1",
          task_date: {
            gte: new Date("2026-07-15T00:00:00.000Z"),
            lte: new Date("2026-07-16T00:00:00.000Z"),
          },
        },
      })
    );
  });

  it("returns only an approved student's own row in explicit cohort context", async () => {
    const findUnique = vi
      .spyOn(prisma.cohort, "findUnique")
      .mockResolvedValue({
        id: "cohort-1",
        title: "Summer",
        practice_start: new Date("2026-07-15T00:00:00.000Z"),
        practice_end: new Date("2026-07-17T00:00:00.000Z"),
        tracks: [
          {
            id: "track-1",
            title: "Backend",
            applications: [
              {
                id: "application-1",
                user: {
                  id: "student-1",
                  full_name: "Student",
                  email: "student@example.com",
                },
                dailyTasks: [],
              },
              {
                id: "application-2",
                user: {
                  id: "student-2",
                  full_name: "Another Student",
                  email: "another@example.com",
                },
                dailyTasks: [],
              },
            ],
          },
        ],
      } as any);

    const result = await service.getCohort(
      "cohort-1",
      "2026-07-13",
      { id: "student-1", role: UserRole.STUDENT }
    );

    expect(result.days).toEqual([
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
    expect(result.students).toHaveLength(2);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cohort-1" },
        select: expect.objectContaining({
          tracks: expect.objectContaining({
            select: expect.objectContaining({
              applications: expect.objectContaining({
                where: {
                  status: "APPROVED",
                },
              }),
            }),
          }),
        }),
      })
    );
  });

  it("does not expose cohort progress to a student without an approved application", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      id: "cohort-1",
      title: "Summer",
      practice_start: new Date("2026-07-01T00:00:00.000Z"),
      practice_end: new Date("2026-07-31T00:00:00.000Z"),
      tracks: [],
    } as any);

    await expect(
      service.getCohort("cohort-1", "2026-07-13", {
        id: "outsider",
        role: UserRole.STUDENT,
      })
    ).rejects.toMatchObject({ code: "APPLICATION_NOT_FOUND" });
  });

  it("shows only the selected working application when one student has two approved tracks", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      id: "cohort-1",
      title: "Practice 2027",
      practice_start: new Date("2027-07-23T00:00:00.000Z"),
      practice_end: new Date("2027-07-24T00:00:00.000Z"),
      tracks: [
        {
          id: "track-backend",
          title: "Backend",
          applications: [{
            id: "application-backend",
            submitted_at: new Date("2026-07-01T00:00:00.000Z"),
            user: {
              id: "student-1",
              full_name: "Student",
              email: "student@example.com",
              active_application_id: "application-backend",
            },
            dailyTasks: [],
          }],
        },
        {
          id: "track-frontend",
          title: "Frontend",
          applications: [{
            id: "application-frontend",
            submitted_at: new Date("2026-07-02T00:00:00.000Z"),
            user: {
              id: "student-1",
              full_name: "Student",
              email: "student@example.com",
              active_application_id: "application-backend",
            },
            dailyTasks: [],
          }],
        },
      ],
    } as any);

    const result = await service.getCohort(
      "cohort-1",
      "2027-07-19",
      { id: "admin-1", role: UserRole.ADMIN }
    );

    expect(result.students).toHaveLength(1);
    expect(result.students[0]).toMatchObject({
      applicationId: "application-backend",
      track: { id: "track-backend", title: "Backend" },
    });
  });
});
