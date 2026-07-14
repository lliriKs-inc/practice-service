import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createErrorHandler } from "../../middlewares/error.middleware";
import type { Logger } from "../../shared/logger/logger.types";
import { AdminController } from "./admin.controller";
import { createAdminRouter } from "./admin.routes";
import type { AdminService } from "./admin.service";
import applicationRoutes from "../application/application.routes";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createTestApp(
  service: Partial<Record<keyof AdminService, ReturnType<typeof vi.fn>>>,
  role: UserRole = UserRole.ADMIN
) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "actor-1", role };
    req.requestId = "admin-route-test";
    next();
  });
  app.use(
    createAdminRouter(
      new AdminController(service as unknown as AdminService)
    )
  );
  app.use(createErrorHandler(logger));
  return app;
}

describe("admin read model routes", () => {
  it("officially reuses the B-03 cohort progress read routes", () => {
    const paths = (applicationRoutes.stack ?? [])
      .filter((layer) => layer.route)
      .map((layer) => `GET ${layer.route?.path}`);

    expect(paths).toEqual(
      expect.arrayContaining([
        "GET /cohorts/:cohortId/progress",
        "GET /cohorts/:cohortId/progress/missed",
      ])
    );
  });

  it("exports every B-05 read-only route", () => {
    const router = createAdminRouter();
    const paths = (router.stack ?? [])
      .filter((layer) => layer.route)
      .map((layer) => `GET ${layer.route?.path}`);

    expect(paths).toEqual([
      "GET /cohorts/:cohortId/admin/applications",
      "GET /cohorts/:cohortId/admin/applications/:applicationId",
      "GET /cohorts/:cohortId/admin/documents",
      "GET /cohorts/:cohortId/admin/documents/:applicationId",
      "GET /cohorts/:cohortId/admin/overview",
    ]);
  });

  it("parses filters and returns applications to an admin", async () => {
    const getApplications = vi.fn().mockResolvedValue([
      { applicationId: "application-1" },
    ]);
    const app = createTestApp({ getApplications });

    const response = await request(app).get(
      "/cohorts/cohort-1/admin/applications?status=APPROVED&trackId=track-1"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { applicationId: "application-1" },
    ]);
    expect(getApplications).toHaveBeenCalledWith("cohort-1", {
      status: "APPROVED",
      trackId: "track-1",
    });
  });

  it("rejects a student before calling the service", async () => {
    const getOverview = vi.fn();
    const app = createTestApp(
      { getOverview },
      UserRole.STUDENT
    );

    const response = await request(app).get(
      "/cohorts/cohort-1/admin/overview"
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(getOverview).not.toHaveBeenCalled();
  });

  it("returns the shared validation envelope for invalid filters", async () => {
    const getDocuments = vi.fn();
    const app = createTestApp({ getDocuments });

    const response = await request(app).get(
      "/cohorts/cohort-1/admin/documents?readiness=UNKNOWN"
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      requestId: "admin-route-test",
    });
    expect(getDocuments).not.toHaveBeenCalled();
  });
});
