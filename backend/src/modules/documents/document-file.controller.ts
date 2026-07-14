import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../../middlewares/error.middleware";
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

export class DocumentFileController {
  constructor(private readonly service: DocumentFileService) {}

  async getStudentReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      }
      return this.send(
        res,
        next,
        await this.service.openStudentReport(
          req.user.id,
          param(req, "applicationId")
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
      return this.send(
        res,
        next,
        await this.service.openAdminReport(
          param(req, "cohortId"),
          param(req, "applicationId")
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
      return this.send(
        res,
        next,
        await this.service.openStudentDocument(
          req.user.id,
          param(req, "applicationId"),
          param(req, "type")
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
      return this.send(
        res,
        next,
        await this.service.openAdminDocument(
          param(req, "cohortId"),
          param(req, "applicationId"),
          param(req, "type")
        )
      );
    } catch (error) {
      return next(error);
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
      `attachment; filename="${file.downloadName}"`
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
