import {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../../middlewares/error.middleware";
import { DailyTaskProgressService } from "./daily-task-progress.service";
import { DailyTaskProgressReadService } from "./daily-task-progress-read.service";
import { updateDailyTaskSchema } from "./dto/update-daily-task.dto";
import { progressWeekQuerySchema } from "./dto/progress-week.dto";
import { missedProgressQuerySchema } from "./dto/missed-progress.dto";

const dailyTaskProgressService =
  new DailyTaskProgressService();

const dailyTaskProgressReadService =
  new DailyTaskProgressReadService();

export class TasksController {
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

      const task =
        await dailyTaskProgressService.updateMine(
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

      const applicationId =
        req.params.applicationId;

      if (typeof applicationId !== "string") {
        throw new AppError(
          "Application id is required",
          400,
          "APPLICATION_ID_REQUIRED"
        );
      }

      const { weekStart } =
        progressWeekQuerySchema.parse(req.query);

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

      const { weekStart } =
        progressWeekQuerySchema.parse(req.query);

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

  async getMissedProgress(
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

      const {
        weekStart,
        studentId,
      } = missedProgressQuerySchema.parse(req.query);

      const result =
        await dailyTaskProgressReadService.getMissed(
          cohortId,
          weekStart,
          studentId
        );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
