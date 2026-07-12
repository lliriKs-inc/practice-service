import {
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  CalendarApplicationNotApprovedError,
  CalendarApplicationNotFoundError,
} from "./dailyTaskCalendar.errors";
import {
  DailyTaskCalendarService,
} from "./dailyTaskCalendar.service";

const applicationId = "application-1";

const approvedApplication = {
  status: ApplicationStatus.APPROVED,
  track: {
    cohort: {
      practice_start:
        new Date("2026-07-13T00:00:00.000Z"),
      practice_end:
        new Date("2026-07-19T00:00:00.000Z"),
    },
  },
};

describe("DailyTaskCalendarService", () => {
  const findUnique = vi.fn();
  const createMany = vi.fn();

  const transaction = {
    application: {
      findUnique,
    },
    dailyTask: {
      createMany,
    },
  } as unknown as Prisma.TransactionClient;

  const service = new DailyTaskCalendarService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing application", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.ensureForApprovedApplication(
        applicationId,
        transaction
      )
    ).rejects.toBeInstanceOf(
      CalendarApplicationNotFoundError
    );

    expect(createMany).not.toHaveBeenCalled();
  });

  it.each([
    ApplicationStatus.PENDING,
    ApplicationStatus.REJECTED,
  ])(
    "rejects an application with status %s",
    async (status) => {
      findUnique.mockResolvedValue({
        ...approvedApplication,
        status,
      });

      await expect(
        service.ensureForApprovedApplication(
          applicationId,
          transaction
        )
      ).rejects.toBeInstanceOf(
        CalendarApplicationNotApprovedError
      );

      expect(createMany).not.toHaveBeenCalled();
    }
  );

  it("loads practice dates through track and cohort", async () => {
    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany.mockResolvedValue({
      count: 5,
    });

    await service.ensureForApprovedApplication(
      applicationId,
      transaction
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: applicationId,
      },
      select: {
        status: true,
        track: {
          select: {
            cohort: {
              select: {
                practice_start: true,
                practice_end: true,
              },
            },
          },
        },
      },
    });
  });

  it("creates one empty task for each weekday", async () => {
    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany.mockResolvedValue({
      count: 5,
    });

    const result =
      await service.ensureForApprovedApplication(
        applicationId,
        transaction
      );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          application_id: applicationId,
          task_date:
            new Date("2026-07-13T00:00:00.000Z"),
        },
        {
          application_id: applicationId,
          task_date:
            new Date("2026-07-14T00:00:00.000Z"),
        },
        {
          application_id: applicationId,
          task_date:
            new Date("2026-07-15T00:00:00.000Z"),
        },
        {
          application_id: applicationId,
          task_date:
            new Date("2026-07-16T00:00:00.000Z"),
        },
        {
          application_id: applicationId,
          task_date:
            new Date("2026-07-17T00:00:00.000Z"),
        },
      ],
      skipDuplicates: true,
    });

    expect(result).toEqual({
      applicationId,
      expectedTaskCount: 5,
      createdTaskCount: 5,
    });
  });

  it("does not write optional task content", async () => {
    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany.mockResolvedValue({
      count: 5,
    });

    await service.ensureForApprovedApplication(
      applicationId,
      transaction
    );

    const call = createMany.mock.calls[0][0];

    for (const task of call.data) {
      expect(task).not.toHaveProperty("description");
      expect(task).not.toHaveProperty("saved_at");
      expect(task).not.toHaveProperty("links");
    }
  });

  it("returns zero created tasks on an idempotent repeat", async () => {
    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany
      .mockResolvedValueOnce({
        count: 5,
      })
      .mockResolvedValueOnce({
        count: 0,
      });

    const first =
      await service.ensureForApprovedApplication(
        applicationId,
        transaction
      );

    const repeated =
      await service.ensureForApprovedApplication(
        applicationId,
        transaction
      );

    expect(first.createdTaskCount).toBe(5);
    expect(repeated).toEqual({
      applicationId,
      expectedTaskCount: 5,
      createdTaskCount: 0,
    });

    expect(createMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        skipDuplicates: true,
      })
    );
  });

  it("supports filling a partially existing calendar", async () => {
    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany.mockResolvedValue({
      count: 2,
    });

    const result =
      await service.ensureForApprovedApplication(
        applicationId,
        transaction
      );

    expect(result).toEqual({
      applicationId,
      expectedTaskCount: 5,
      createdTaskCount: 2,
    });
  });

  it("does not call createMany for a weekend-only period", async () => {
    findUnique.mockResolvedValue({
      status: ApplicationStatus.APPROVED,
      track: {
        cohort: {
          practice_start:
            new Date("2026-07-18T00:00:00.000Z"),
          practice_end:
            new Date("2026-07-19T00:00:00.000Z"),
        },
      },
    });

    const result =
      await service.ensureForApprovedApplication(
        applicationId,
        transaction
      );

    expect(result).toEqual({
      applicationId,
      expectedTaskCount: 0,
      createdTaskCount: 0,
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("propagates a transaction write failure", async () => {
    const transactionError =
      new Error("transaction write failed");

    findUnique.mockResolvedValue(
      approvedApplication
    );
    createMany.mockRejectedValue(
      transactionError
    );

    await expect(
      service.ensureForApprovedApplication(
        applicationId,
        transaction
      )
    ).rejects.toBe(transactionError);

    expect(createMany).toHaveBeenCalledTimes(1);
  });
});
