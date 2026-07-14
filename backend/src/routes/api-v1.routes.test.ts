import request from "supertest";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { generateToken } from "../shared/jwt";
import {
  API_V1_MOUNTS,
  API_V1_PREFIX,
  listRegisteredApiRoutes,
} from "./api-v1.registry";

describe("B-06 API v1 route registry", () => {
  it("registers every target router once", () => {
    const ids = API_V1_MOUNTS.map((mount) => mount.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "auth",
      "cohorts",
      "invitations",
      "public-survey",
      "tracks",
      "survey",
      "application-practice",
      "test-task",
      "document-files",
      "document-admin",
      "admin",
    ]);
    expect(ids).not.toContain("cohort-role");
  });

  it("produces unique method/path pairs under /api/v1", () => {
    const routes = listRegisteredApiRoutes();
    const keys = routes.map(
      ({ method, path }) => `${method} ${path}`
    );

    expect(routes.length).toBeGreaterThan(30);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      routes.every(({ path }) => path.startsWith(API_V1_PREFIX))
    ).toBe(true);
    expect(keys).toEqual(
      expect.arrayContaining([
        "POST /api/v1/auth/login",
        "GET /api/v1/cohorts/public/current",
        "GET /api/v1/public/invitations/:token/form",
        "GET /api/v1/me/applications",
        "GET /api/v1/cohorts/:cohortId/progress",
        "GET /api/v1/cohorts/:cohortId/admin/overview",
        "PUT /api/v1/cohorts/:cohortId/admin/applications/:applicationId/documents/:type/fields/:fieldKey",
        "GET /api/v1/cohorts/:cohortId/admin/applications/:applicationId/report/file",
      ])
    );
    expect(keys.some((key) => key.includes("/cohorts/roles"))).toBe(
      false
    );
    expect(keys.some((key) => key.includes("/test-task/cohorts"))).toBe(
      false
    );
  });

  it("returns the shared JSON 404 for an unknown authenticated API route", async () => {
    const app = createApp({ readinessCheck: async () => undefined });
    const token = generateToken({
      id: "admin-1",
      role: UserRole.ADMIN,
    });

    const response = await request(app)
      .get("/api/v1/unknown-route")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "unknown-route-test");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "ROUTE_NOT_FOUND",
      message:
        "Route GET /api/v1/unknown-route not found",
      details: null,
      requestId: "unknown-route-test",
    });
  });

  it("does not serve old unversioned business routes", async () => {
    const app = createApp({ readinessCheck: async () => undefined });

    const response = await request(app).post("/auth/login").send({});

    expect(response.status).toBe(404);
  });
});
