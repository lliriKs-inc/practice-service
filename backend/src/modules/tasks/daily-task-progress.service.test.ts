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
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import { DailyTaskProgressService } from "./daily-task-progress.service";

describe("DailyTaskProgressService", () => {
  const service = new DailyTaskProgressService();

  const task = {
    id: "task-1",
    task_date: new Date("2026-07-13T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates description and replaces links", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue(task);

    const update = vi.fn().mockResolvedValue(task);
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const findUnique = vi.fn().mockResolvedValue({
      ...task,
      description: "Updated",
      links: [
        { id: "link-1", url: "https://example.com" },
      ],
    });

    const tx = {
      dailyTask: {
        findFirst,
        update,
        findUnique,
      },
      dailyTaskLink: {
        deleteMany,
        createMany,
      },
    } as unknown as Prisma.TransactionClient;

    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (callback) => callback(tx)
    );

    const result = await service.updateMine(
      "user-1",
      "task-1",
      {
        description: "Updated",
        links: [
          { url: "https://example.com" },
        ],
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        description: "Updated",
        saved_at: expect.any(Date),
      }),
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { daily_task_id: "task-1" },
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          daily_task_id: "task-1",
          url: "https://example.com",
        },
      ],
    });

    expect(result?.links).toHaveLength(1);
  });

  it("rejects a foreign task", async () => {
    const tx = {
      dailyTask: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      dailyTaskLink: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (callback) => callback(tx)
    );

    await expect(
      service.updateMine("user-1", "foreign-task", {
        description: "Text",
        links: [],
      })
    ).rejects.toMatchObject({
      code: "DAILY_TASK_NOT_FOUND",
    });
  });

  it("rejects a weekend task", async () => {
    const tx = {
      dailyTask: {
        findFirst: vi.fn().mockResolvedValue({
          id: "task-1",
          task_date: new Date("2026-07-18T00:00:00.000Z"),
        }),
      },
      dailyTaskLink: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (callback) => callback(tx)
    );

    await expect(
      service.updateMine("user-1", "task-1", {
        description: "Text",
        links: [],
      })
    ).rejects.toMatchObject({
      code: "DAILY_TASK_WEEKEND_EDIT_FORBIDDEN",
    });
  });

  it("does not write links when the replacement list is empty", async () => {
    const tx = {
      dailyTask: {
        findFirst: vi.fn().mockResolvedValue(task),
        update: vi.fn().mockResolvedValue(task),
        findUnique: vi.fn().mockResolvedValue({
          ...task,
          links: [],
        }),
      },
      dailyTaskLink: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    vi.spyOn(prisma, "$transaction").mockImplementation(
      async (callback) => callback(tx)
    );

    await service.updateMine("user-1", "task-1", {
      description: null,
      links: [],
    });

    expect(tx.dailyTaskLink.createMany).not.toHaveBeenCalled();
  });
});
