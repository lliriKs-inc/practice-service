import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { DocumentReadinessService } from "./document-readiness.service";
import { DocumentEavService } from "./document-eav.service";
import { updateDocumentFieldSchema } from "./dto/update-document-field.dto";
import { ReportService } from "./report.service";
import { reportStatusSchema } from "./dto/report-status.dto";
import { LocalStorageService } from "../../shared/storage";
import { config } from "../../shared/config";
import {
  DocumentTemplate,
} from "./documentGenerator.service";
import {
  DOCX_CONTENT_TYPE,
  GeneratedDocumentService,
} from "./generated-document.service";

const readinessService =
  new DocumentReadinessService();
const eavService = new DocumentEavService();
const reportService = new ReportService(
  new LocalStorageService({
    rootDirectory: config.storage.uploadDir,
  })
);
const generatedDocumentService =
  new GeneratedDocumentService(
    new LocalStorageService({
      rootDirectory: config.storage.uploadDir,
    })
  );

export class DocumentsController {
  async getApplicationReadiness(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId =
        req.params.applicationId;

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      const result =
        await readinessService.getForStudent(
          req.user.id,
          applicationId
        );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getApplicationDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId =
        req.params.applicationId;

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      const documents =
        await eavService.getForStudent(
          req.user.id,
          applicationId
        );

      return res.status(200).json(documents);
    } catch (error) {
      return next(error);
    }
  }

  async updateApplicationDocumentField(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId =
        req.params.applicationId;
      const type = req.params.type;
      const fieldKey = req.params.fieldKey;

      if (
        typeof applicationId !== "string" ||
        typeof type !== "string" ||
        typeof fieldKey !== "string"
      ) {
        throw new AppError(
          "Invalid document parameters",
          400,
          "INVALID_DOCUMENT_PARAMETERS"
        );
      }

      const { value } =
        updateDocumentFieldSchema.parse(
          req.body
        );

      const field =
        await eavService.updateStudentField(
          req.user.id,
          applicationId,
          type,
          fieldKey,
          value
        );

      return res.status(200).json(field);
    } catch (error) {
      return next(error);
    }
  }

  async getApplicationReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId =
        req.params.applicationId;

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      const report =
        await reportService.getMine(
          req.user.id,
          applicationId
        );

      return res.status(200).json(report);
    } catch (error) {
      return next(error);
    }
  }

  async replaceApplicationReport(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId =
        req.params.applicationId;

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      if (!req.file) {
        throw new AppError(
          "Report file is required",
          400,
          "REPORT_FILE_REQUIRED"
        );
      }

      const report =
        await reportService.replaceMine(
          req.user.id,
          applicationId,
          {
            category: "reports",
            content: req.file.buffer,
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
          }
        );

      return res.status(200).json(report);
    } catch (error) {
      return next(error);
    }
  }

  async updateReportStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const cohortId = req.params.cohortId;
      const applicationId =
        req.params.applicationId;

      if (
        typeof cohortId !== "string" ||
        typeof applicationId !== "string"
      ) {
        throw new AppError(
          "Invalid report parameters",
          400,
          "INVALID_REPORT_PARAMETERS"
        );
      }

      const { status } =
        reportStatusSchema.parse(req.body);

      const result =
        await reportService.review(
          req.user?.id ?? "unknown",
          cohortId,
          applicationId,
          status
        );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async generateApplicationDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        );
      }

      const applicationId = req.params.applicationId;
      const type = req.params.type as DocumentTemplate;

      if (
        typeof applicationId !== "string" ||
        typeof type !== "string"
      ) {
        throw new AppError(
          "Invalid document parameters",
          400,
          "INVALID_DOCUMENT_PARAMETERS"
        );
      }

      const allowedTypes: DocumentTemplate[] = [
        "individual-task",
        "review",
        "title-page",
        "notice",
      ];

      if (!allowedTypes.includes(type)) {
        throw new AppError(
          "Invalid document type",
          400,
          "INVALID_DOCUMENT_TYPE"
        );
      }

      const { buffer } =
        await generatedDocumentService.generateMine(
          req.user.id,
          applicationId,
          type
        );

      res.setHeader(
        "Content-Type",
        DOCX_CONTENT_TYPE
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}.docx"`
      );

      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  }
}
