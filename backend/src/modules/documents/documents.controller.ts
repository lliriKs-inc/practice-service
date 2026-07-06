import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { DocumentsService } from "./documents.service";
import { DocumentTemplate } from "./documentGenerator.service";

const service = new DocumentsService();

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

      const documents = await service.update(
        req.user.id,
        req.cohortId,
        req.body
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

      const { userId, ...data } = req.body;

      if (!userId) {
        throw new AppError("userId is required", 400);
      }

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

      const { userId } = req.body;

      if (!userId) {
        throw new AppError("userId is required", 400);
      }

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
}