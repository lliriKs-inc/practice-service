import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../../middlewares/error.middleware";
import {
  auditLogger,
  type AuditLogger,
} from "../../shared/logger";
import { FileDownloadStreamError } from "../../shared/storage";
import {
  DocumentFileService,
  type DownloadableDocumentFile,
} from "./document-file.service";

function param(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string" || !value) {
    throw new AppError(
      "Document file not found",
      404,
      "DOCUMENT_FILE_NOT_FOUND"
    );
  }

  return value;
}

function asciiDownloadName(downloadName: string): string {
  const safe = downloadName
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim();
  return safe || "report";
}

export class DocumentFileController {
  constructor(
    private readonly service: DocumentFileService,
    private readonly audit: AuditLogger = auditLogger
  ) {}

  async getStudentReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }
      const applicationId = param(req, "applicationId");
      return await this.download(
        req,
        res,
        next,
        "report",
        applicationId,
        this.service.openStudentReport(
          req.user.id,
          applicationId
        )
      );
    } catch (error) {
      return next(error);
    }
  }

  async getAdminReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const applicationId = param(req, "applicationId");
      return await this.download(
        req,
        res,
        next,
        "report",
        applicationId,
        this.service.openAdminReport(
          param(req, "cohortId"),
          applicationId
        )
      );
    } catch (error) {
      return next(error);
    }
  }

  async getStudentDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }
      const applicationId = param(req, "applicationId");
      const type = param(req, "type");
      return await this.download(
        req,
        res,
        next,
        "document",
        `${applicationId}:${type}`,
        this.service.openStudentDocument(
          req.user.id,
          applicationId,
          type
        )
      );
    } catch (error) {
      return next(error);
    }
  }

  async getAdminDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const applicationId = param(req, "applicationId");
      const type = param(req, "type");
      return await this.download(
        req,
        res,
        next,
        "document",
        `${applicationId}:${type}`,
        this.service.openAdminDocument(
          param(req, "cohortId"),
          applicationId,
          type
        )
      );
    } catch (error) {
      return next(error);
    }
  }

  private async download(
    req: Request,
    res: Response,
    next: NextFunction,
    resourceType: string,
    resourceId: string,
    filePromise: Promise<DownloadableDocumentFile>
  ) {
    try {
      const file = await filePromise;
      this.audit.record({
        action: "FILE_DOWNLOAD_GRANTED",
        outcome: "success",
        actorId: req.user?.id ?? null,
        requestId: req.requestId ?? null,
        resourceType,
        resourceId,
        metadata: {
          contentType: file.contentType,
        },
      });
      return this.send(res, next, file);
    } catch (error) {
      this.audit.record({
        action: "FILE_DOWNLOAD_DENIED",
        outcome: error instanceof AppError && error.statusCode < 500
          ? "denied"
          : "failure",
        actorId: req.user?.id ?? null,
        requestId: req.requestId ?? null,
        resourceType,
        resourceId,
        metadata: { error },
      });
      throw error;
    }
  }

  private send(
    res: Response,
    next: NextFunction,
    file: DownloadableDocumentFile
  ) {
    res.status(200);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", String(file.size));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiDownloadName(file.downloadName)}"`
    );
    res.setHeader(
      "X-Download-Filename",
      encodeURIComponent(file.downloadName)
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.stream.once("error", () => {
      if (!res.headersSent) {
        next(new FileDownloadStreamError());
        return;
      }
      res.destroy();
    });
    file.stream.pipe(res);
    return;
  }
}
