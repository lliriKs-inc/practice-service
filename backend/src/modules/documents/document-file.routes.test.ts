import { Readable } from "node:stream";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
const auditRecord = vi.fn();

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
        service as unknown as DocumentFileService,
        { record: auditRecord }
      )
    )
  );
  app.use(createErrorHandler(logger));
  return app;
}

describe("protected document file routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("streams a report to an admin through the scoped resource endpoint", async () => {
    const openAdminReport = vi.fn().mockResolvedValue({
      stream: Readable.from("report"),
      size: 6,
      contentType: "application/pdf",
      downloadName: "Анализ материалов Nike Dunk SB.docx",
    });

    const response = await request(
      appFor({ openAdminReport }, UserRole.ADMIN)
    ).get(
      "/cohorts/cohort-1/admin/applications/application-1/report/file"
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="______ __________ Nike Dunk SB.docx"'
    );
    expect(response.headers["x-download-filename"]).toBe(
      "%D0%90%D0%BD%D0%B0%D0%BB%D0%B8%D0%B7%20%D0%BC%D0%B0%D1%82%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%D0%BE%D0%B2%20Nike%20Dunk%20SB.docx"
    );
    expect(openAdminReport).toHaveBeenCalledWith(
      "cohort-1",
      "application-1"
    );
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: "FILE_DOWNLOAD_GRANTED",
      actorId: "actor-1",
      requestId: "document-file-route-test",
      resourceType: "report",
      resourceId: "application-1",
    }));
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
