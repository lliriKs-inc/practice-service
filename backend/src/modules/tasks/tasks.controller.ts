import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { TasksService } from "./tasks.service";
import { CreateTaskSchema } from "./dto/create-task.dto";
import { UpdateTaskSchema } from "./dto/update-task.dto";
import { TaskParamsSchema, WeekQuerySchema } from "./dto/task-request.dto";
import { DailyTaskProgressService } from "./daily-task-progress.service";
import { updateDailyTaskSchema } from "./dto/update-daily-task.dto";
import { DailyTaskProgressReadService } from "./daily-task-progress-read.service";
import { progressWeekQuerySchema } from "./dto/progress-week.dto";

const service = new TasksService();
const dailyTaskProgressService =
  new DailyTaskProgressService();
const dailyTaskProgressReadService =
  new DailyTaskProgressReadService();

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

      const { weekStart } = WeekQuerySchema.parse(req.query);

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

      const { id: taskId } = TaskParamsSchema.parse(req.params);
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

      const { id: taskId } = TaskParamsSchema.parse(req.params);
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

    const { weekStart } = WeekQuerySchema.parse(req.query);

    const tasks = await service.findAllWeek(req.cohortId, weekStart);
      return res.json(tasks);
    } catch (error) {
      next(error);
    }
  }
  async updateDailyTask(
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

      const taskId = req.params.taskId;

      if (typeof taskId !== "string") {
        throw new AppError(
          "Daily task id is required",
          400,
          "DAILY_TASK_ID_REQUIRED"
        );
      }

      const dto = updateDailyTaskSchema.parse(req.body);

      const task = await dailyTaskProgressService.updateMine(
        req.user.id,
        taskId,
        dto
      );

      return res.status(200).json(task);
    } catch (error) {
      return next(error);
    }
  }
  async getMyProgress(
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

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      const { weekStart } = progressWeekQuerySchema.parse(
        req.query
      );

      const result =
        await dailyTaskProgressReadService.getMine(
          req.user.id,
          applicationId,
          weekStart
        );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getCohortProgress(
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

      const cohortId = req.params.cohortId;

      if (typeof cohortId !== "string") {
        throw new AppError(
          "Cohort id is required",
          400,
          "COHORT_ID_REQUIRED"
        );
      }

      const { weekStart } = progressWeekQuerySchema.parse(
        req.query
      );

      const result =
        await dailyTaskProgressReadService.getCohort(
          cohortId,
          weekStart
        );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
