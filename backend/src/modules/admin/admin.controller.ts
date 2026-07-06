import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { AdminService } from "./admin.service";

const service = new AdminService();

export class AdminController {
  async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const students = await service.getApprovedStudents(req.cohortId);

      return res.json(students);
    } catch (error) {
      next(error);
    }
  }

  async getDocuments(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
        }

        const documents = await service.getDocuments(req.cohortId);

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async getStudentDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const userId = req.params.userId;

      if (typeof userId !== "string") {
        throw new AppError("userId is required", 400);
      }

      const documents = await service.getStudentDocuments(req.cohortId, userId);

      return res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const tasks = await service.getTasks(req.cohortId);

      return res.json(tasks);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const stats = await service.getStats(req.cohortId);

      return res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}