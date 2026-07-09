import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { TasksService } from "./tasks.service";
import { CreateTaskSchema } from "./dto/create-task.dto";
import { UpdateTaskSchema } from "./dto/update-task.dto";

const service = new TasksService();

export class TasksController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const dto = CreateTaskSchema.parse(req.body);
      const task = await service.create(req.user.id, req.cohortId, dto);

      return res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }

  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const tasks = await service.findMine(req.user.id, req.cohortId);

      return res.json(tasks);
    } catch (error) {
      next(error);
    }
  }

  async getWeek(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const weekStart = req.query.weekStart;

      if (typeof weekStart !== "string") {
        throw new AppError("weekStart is required", 400);
      }

      const tasks = await service.findWeek(req.user.id, req.cohortId, weekStart);

      return res.json(tasks);
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

      const taskId = req.params.id;

      if (typeof taskId !== "string") {
        throw new AppError("Task id is required", 400);
      }

      const dto = UpdateTaskSchema.parse(req.body);

      const task = await service.update(
        req.user.id,
        req.cohortId,
        taskId,
        dto
      );
      
      return res.json(task);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const taskId = req.params.id;

      if (typeof taskId !== "string") {
        throw new AppError("Task id is required", 400);
      }

      const result = await service.delete(
        req.user.id,
        req.cohortId,
        taskId
      );

      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const tasks = await service.findAll(req.cohortId);

      return res.json(tasks);
    } catch (error) {
      next(error);
    }
  }

  async getAllWeek(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.cohortId) {
        throw new AppError("No active cohort selected", 400);
      }

      const weekStart = req.query.weekStart;

      if (typeof weekStart !== "string") {
        throw new AppError("weekStart is required", 400);
      }

      const tasks = await service.findAllWeek(req.cohortId, weekStart);

      return res.json(tasks);
    } catch (error) {
      next(error);
    }
  }
}