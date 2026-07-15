import { Request, Response, NextFunction } from "express";
import { CohortService } from "./cohort.service";
import { createCohortSchema } from "./dto/create-cohort.dto";
import { updateCohortSchema } from "./dto/update-cohort.dto";
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

  async listCohorts(_req: Request, res: Response, next: NextFunction) {
    try { return res.json(await this.cohortService.listCohorts()); } catch (error) { return next(error); }
  }

  async getCohort(req: Request, res: Response, next: NextFunction) {
    try {
      const cohort = await this.cohortService.getCohort(String(req.params.cohortId));
      if (!cohort) return next(new AppError("Cohort not found", 404, "COHORT_NOT_FOUND"));
      return res.json(cohort);
    } catch (error) { return next(error); }
  }

  async updateCohort(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateCohortSchema.safeParse(req.body);
      if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
      return res.json(await this.cohortService.updateCohort(String(req.params.cohortId), parsed.data));
    } catch (error) { return next(error); }
  }

  async activateCohort(req: Request, res: Response, next: NextFunction) {
    try { return res.json(await this.cohortService.activateCohort(String(req.params.cohortId))); } catch (error) { return next(error); }
  }

  async closeCohort(req: Request, res: Response, next: NextFunction) {
    try { return res.json(await this.cohortService.closeCohort(String(req.params.cohortId))); } catch (error) { return next(error); }
  }

  async deleteCohort(req: Request, res: Response, next: NextFunction) {
    try {
      await this.cohortService.deleteCohort(
        String(req.params.cohortId),
        req.user?.id ?? null,
        req.requestId ?? null,
      );
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  }
}
