import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { DocumentsService } from "./documents.service";
import { DocumentTemplate } from "./documentGenerator.service";
import { UpdateDocumentSchema } from "./dto/update-document.dto";
import {
  ApproveReportSchema,
  UpdateReviewRequestSchema,
} from "./dto/update-review.dto";
import { DocumentReadinessService } from "./document-readiness.service";
import { DocumentEavService } from "./document-eav.service";
import { updateDocumentFieldSchema } from "./dto/update-document-field.dto";

const service = new DocumentsService();
const readinessService =
  new DocumentReadinessService();
const eavService = new DocumentEavService();

export class DocumentsController {
  async getMyDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const documents = await service.getByUser(req.user.id, req.cohortId);

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const documents = await service.create(req.user.id, req.cohortId);

      return res.status(201).json(documents);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }
      const dto = UpdateDocumentSchema.parse(req.body);

      const documents = await service.update(
        req.user.id,
        req.cohortId,
        dto
      );

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async uploadReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      if (!req.file) {
        throw new AppError("Report file is required", 400);
      }

      const reportFileUrl = `/uploads/${req.file.filename}`;

      const documents = await service.updateReportFile(
        req.user.id,
        req.cohortId,
        reportFileUrl
      );

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const { userId, ...data } = UpdateReviewRequestSchema.parse(req.body);
      const documents = await service.updateReview(userId, req.cohortId, data);

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async approveReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const { userId } = ApproveReportSchema.parse(req.body);
      const result = await service.approveReport(userId, req.cohortId);

      if (result.count === 0) {
        throw new AppError("Documents not found", 404);
      }

      return res.json({ message: "Report approved" });
    } catch (error) {
      next(error);
    }
  }
  async getReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const readiness = await service.getReadiness(req.user.id, req.cohortId);

      return res.json(readiness);
    } catch (error) {
      next(error);
    }
  }

  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const type = req.params.type as DocumentTemplate;
      const allowedTypes: DocumentTemplate[] = [
        "individual-task",
        "review",
        "title-page",
      ];

      if (!allowedTypes.includes(type)) {
        throw new AppError("Invalid document type", 400);
      }

      const buffer = await service.generateDocument(
        req.user.id,
        req.cohortId,
        type
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}.docx"`
      );

      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

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
}