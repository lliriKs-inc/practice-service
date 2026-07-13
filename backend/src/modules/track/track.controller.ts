import { Request, Response, NextFunction } from "express";
import { TrackService } from "./track.service";
import { createTrackSchema } from "./dto/create-track.dto";
import { AppError } from "../../middlewares/error.middleware";

const trackService = new TrackService();

export async function createTrack(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createTrackSchema.safeParse(req.body);
    if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
    if (req.cohortId && req.cohortId !== parsed.data.cohort_id) return next(new AppError("Cohort context mismatch", 403, "COHORT_CONTEXT_MISMATCH"));
    return res.status(201).json(await trackService.createTrack(parsed.data));
  } catch (error) { return next(error); }
}

export async function getTracks(req: Request, res: Response, next: NextFunction) {
  try {
    const cohortId = req.cohortId;
    if (!cohortId) return next(new AppError("Cohort context is required", 400, "COHORT_CONTEXT_MISSING"));
    return res.status(200).json(await trackService.getTracksByCohort(cohortId));
  } catch (error) { return next(error); }
}
