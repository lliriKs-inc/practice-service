import { Readable } from "node:stream";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createApp } from "../../app";
import { generateToken } from "../../shared/jwt";
import { AdminService } from "./admin.service";
import { DocumentFileService } from "../documents/document-file.service";

describe("B-05 application mount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serves the documented route without a duplicated admin prefix", async () => {
    vi.spyOn(AdminService.prototype, "getOverview").mockResolvedValue({
      cohortId: "cohort-1",
    } as never);
    const token = generateToken({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    const app = createApp({ readinessCheck: async () => undefined });

    const response = await request(app)
      .get("/cohorts/cohort-1/admin/overview")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ cohortId: "cohort-1" });
  });

  it("mounts the protected admin report endpoint at its documented path", async () => {
    vi.spyOn(
      DocumentFileService.prototype,
      "openAdminReport"
    ).mockResolvedValue({
      stream: Readable.from("report"),
      size: 6,
      contentType: "application/pdf",
      downloadName: "report.pdf",
    });
    const token = generateToken({
      id: "admin-1",
      role: UserRole.ADMIN,
    });
    const app = createApp({ readinessCheck: async () => undefined });

    const response = await request(app)
      .get(
        "/cohorts/cohort-1/admin/applications/application-1/report/file"
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
  });
});
