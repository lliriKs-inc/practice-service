import { UserRole } from "@prisma/client";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "../../middlewares/error.middleware";
import type { Logger } from "../../shared/logger/logger.types";
import { DailyTaskProgressReadService } from "../tasks/daily-task-progress-read.service";
import applicationRoutes from "./application.routes";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createTestApp(role: UserRole) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "actor-1", role };
    next();
  });
  app.use(applicationRoutes);
  app.use(createErrorHandler(logger));
  return app;
}

describe("cohort progress resource policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([UserRole.ADMIN, UserRole.STUDENT])(
    "allows %s and passes the authenticated viewer to the read service",
    async (role) => {
      const getCohort = vi
        .spyOn(DailyTaskProgressReadService.prototype, "getCohort")
        .mockResolvedValue({ students: [] } as any);

      const response = await request(createTestApp(role)).get(
        "/cohorts/cohort-1/progress?weekStart=2026-07-13"
      );

      expect(response.status).toBe(200);
      expect(getCohort).toHaveBeenCalledWith(
        "cohort-1",
        "2026-07-13",
        { id: "actor-1", role }
      );
    }
  );

  it("keeps missed-day progress restricted to administrators", async () => {
    const getMissed = vi.spyOn(
      DailyTaskProgressReadService.prototype,
      "getMissed"
    );

    const response = await request(
      createTestApp(UserRole.STUDENT)
    ).get(
      "/cohorts/cohort-1/progress/missed?weekStart=2026-07-13"
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(getMissed).not.toHaveBeenCalled();
  });
});
