import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import { DailyTaskProgressReadService } from "./daily-task-progress-read.service";

function utcDateOnly(offsetDays: number): Date {
  const now = new Date();

  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );

  today.setUTCDate(today.getUTCDate() + offsetDays);

  return today;
}

const service = new DailyTaskProgressReadService();

describe("DailyTaskProgressReadService.getMissed", () => {
  beforeEach(() => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      practice_start: new Date("2026-07-01T00:00:00.000Z"),
      practice_end: new Date("2099-12-31T00:00:00.000Z"),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only tasks with null description", async () => {
    const findMany = vi
      .spyOn(prisma.application, "findMany")
      .mockResolvedValue([
        {
          id: "application-1",
          user: {
            id: "student-1",
            full_name: "Student One",
            email: "student@example.com",
          },
          track: {
            id: "track-1",
            title: "Backend",
          },
          dailyTasks: [
            {
              id: "task-1",
              task_date: utcDateOnly(-1),
              description: null,
              saved_at: null,
              application_id: "application-1",
              links: [],
            },
          ],
        },
      ] as any);

    const result = await service.getMissed(
      "cohort-1",
      "2026-07-13"
    );

    expect(result.missed).toHaveLength(1);
    expect(result.missed[0]).toMatchObject({
      applicationId: "application-1",
      taskId: "task-1",
      student: {
        id: "student-1",
      },
      track: {
        id: "track-1",
      },
    });

    expect(findMany).toHaveBeenCalled();
  });

  it("does not return future tasks", async () => {
    vi.spyOn(prisma.application, "findMany")
      .mockResolvedValue([
        {
          id: "application-1",
          user: {
            id: "student-1",
            full_name: "Student One",
            email: "student@example.com",
          },
          track: {
            id: "track-1",
            title: "Backend",
          },
          dailyTasks: [],
        },
      ] as any);

    const result = await service.getMissed(
      "cohort-1",
      "2026-07-13"
    );

    expect(result.missed).toEqual([]);
  });

  it("filters by studentId", async () => {
    const findMany = vi
      .spyOn(prisma.application, "findMany")
      .mockResolvedValue([]);

    await service.getMissed(
      "cohort-1",
      "2026-07-13",
      "student-42"
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: "student-42",
          status: "APPROVED",
          track: {
            cohort_id: "cohort-1",
          },
        }),
      })
    );
  });

  it("returns an empty result for a week entirely in the future", async () => {
    const findMany = vi.spyOn(
      prisma.application,
      "findMany"
    );

    const result = await service.getMissed(
      "cohort-1",
      "2099-01-04"
    );

    expect(result.missed).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown cohort even when the requested week is in the future", async () => {
    vi.mocked(prisma.cohort.findUnique).mockResolvedValueOnce(null);

    await expect(
      service.getMissed("missing-cohort", "2099-01-04")
    ).rejects.toMatchObject({ code: "COHORT_NOT_FOUND" });
  });

  it("clips missed task lookup to the cohort practice period", async () => {
    vi.mocked(prisma.cohort.findUnique).mockResolvedValueOnce({
      practice_start: new Date("2026-07-15T00:00:00.000Z"),
      practice_end: new Date("2026-07-16T00:00:00.000Z"),
    } as any);
    const findMany = vi
      .spyOn(prisma.application, "findMany")
      .mockResolvedValue([]);

    await service.getMissed("cohort-1", "2026-07-13");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          dailyTasks: expect.objectContaining({
            where: expect.objectContaining({
              task_date: {
                gte: new Date("2026-07-15T00:00:00.000Z"),
                lte: new Date("2026-07-16T00:00:00.000Z"),
              },
            }),
          }),
        }),
      })
    );
  });
});
