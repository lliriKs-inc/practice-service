import { Request, Response, NextFunction } from "express";
import { CohortService } from "./cohort.service";
import { AppError } from "../../middlewares/error.middleware";

export class CohortController {
  private cohortService = new CohortService();

  async createCohort(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        title,
        status,
        application_start,
        application_end,
        practice_start,
        practice_end,
      } = req.body;

      if (!title || !practice_start || !practice_end) {
        return next(
          new AppError(
            "Отсутствуют обязательные поля (title, practice_start, practice_end)",
            400,
            "BAD_REQUEST"
          )
        );
      }

      const cohort = await this.cohortService.createCohort({
        title,
        status,
        application_start: application_start
          ? new Date(application_start)
          : undefined,
        application_end: application_end
          ? new Date(application_end)
          : undefined,
        practice_start: new Date(practice_start),
        practice_end: new Date(practice_end),
        created_by: req.user!.id,
      });

      return res.status(201).json(cohort);
    } catch (error) {
      return next(error);
    }
  }

  async getCurrentPublicCohort(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const cohort = await this.cohortService.findCurrentPublicCohort();

      if (!cohort) {
        return next(
          new AppError(
            "Нет активной когорты для подачи заявок в данный момент",
            404,
            "COHORT_NOT_FOUND"
          )
        );
      }

      return res.status(200).json(cohort);
    } catch (error) {
      return next(error);
    }
  }
}