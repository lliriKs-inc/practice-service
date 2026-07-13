import { Request, Response, NextFunction } from "express";
import { CohortService } from "./cohort.service";
import { createCohortSchema } from "./dto/create-cohort.dto";
import { AppError } from "../../middlewares/error.middleware";

export class CohortController {
  private cohortService = new CohortService();

  async createCohort(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createCohortSchema.safeParse(req.body);
      if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
      const cohort = await this.cohortService.createCohort({ ...parsed.data, created_by: req.user!.id });
      return res.status(201).json(cohort);
    } catch (error) { return next(error); }
  }

  async getCurrentPublicCohort(_req: Request, res: Response, next: NextFunction) {
    try {
      const cohort = await this.cohortService.findCurrentPublicCohort();
      if (!cohort) return next(new AppError("No active cohort is accepting applications", 404, "COHORT_NOT_FOUND"));
      return res.status(200).json(cohort);
    } catch (error) { return next(error); }
  }
}
