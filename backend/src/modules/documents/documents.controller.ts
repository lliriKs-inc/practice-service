import { Request, Response } from "express";
import { DocumentsService } from "./documents.service";

const service = new DocumentsService();

export class DocumentsController {
  async getMyDocuments(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      const documents = await service.getByUser(req.user.id, req.cohortId);

      return res.json(documents);
    } catch (error) {
      return res.status(403).json({ message: (error as Error).message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      const documents = await service.create(req.user.id, req.cohortId);

      return res.status(201).json(documents);
    } catch (error) {
      return res.status(403).json({ message: (error as Error).message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      const documents = await service.update(
        req.user.id,
        req.cohortId,
        req.body
      );

      return res.json(documents);
    } catch (error) {
      return res.status(403).json({ message: (error as Error).message });
    }
  }

  async uploadReport(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Report file is required" });
      }

      const reportFileUrl = `/uploads/${req.file.filename}`;

      const documents = await service.updateReportFile(
        req.user.id,
        req.cohortId,
        reportFileUrl
      );

      return res.json(documents);
    } catch (error) {
      return res.status(403).json({ message: (error as Error).message });
    }
  }

  async updateReview(req: Request, res: Response) {
    try {
      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      const { userId, ...data } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const documents = await service.updateReview(userId, req.cohortId, data);

      return res.json(documents);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }

  async approveReport(req: Request, res: Response) {
    try {
      if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const result = await service.approveReport(userId, req.cohortId);

      if (result.count === 0) {
        return res.status(404).json({ message: "Documents not found" });
      }

      return res.json({ message: "Report approved" });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }
}