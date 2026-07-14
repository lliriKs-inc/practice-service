import { Readable } from "node:stream";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "../../middlewares/error.middleware";
import type { Logger } from "../../shared/logger/logger.types";
import { DocumentFileController } from "./document-file.controller";
import { createDocumentFileRouter } from "./document-file.routes";
import type { DocumentFileService } from "./document-file.service";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function appFor(
  service: Partial<Record<keyof DocumentFileService, ReturnType<typeof vi.fn>>>,
  role: UserRole
) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: "actor-1", role };
    req.requestId = "document-file-route-test";
    next();
  });
  app.use(
    createDocumentFileRouter(
      new DocumentFileController(
        service as unknown as DocumentFileService
      )
    )
  );
  app.use(createErrorHandler(logger));
  return app;
}

describe("protected document file routes", () => {
  it("streams a report to an admin through the scoped resource endpoint", async () => {
    const openAdminReport = vi.fn().mockResolvedValue({
      stream: Readable.from("report"),
      size: 6,
      contentType: "application/pdf",
      downloadName: "report.pdf",
    });

    const response = await request(
      appFor({ openAdminReport }, UserRole.ADMIN)
    ).get(
      "/cohorts/cohort-1/admin/applications/application-1/report/file"
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(openAdminReport).toHaveBeenCalledWith(
      "cohort-1",
      "application-1"
    );
  });

  it("rejects a student before resolving an admin file", async () => {
    const openAdminDocument = vi.fn();

    const response = await request(
      appFor({ openAdminDocument }, UserRole.STUDENT)
    ).get(
      "/cohorts/cohort-1/admin/applications/application-1/documents/NOTICE/file"
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(openAdminDocument).not.toHaveBeenCalled();
  });
});
