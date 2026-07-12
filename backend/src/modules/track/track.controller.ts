import { Request, Response, NextFunction } from "express";
import { TrackService } from "./track.service";
import { AppError } from "../../middlewares/error.middleware";
import { UserRole } from "@prisma/client";

const trackService = new TrackService();

export async function createTrack(req: Request, res: Response, next: NextFunction) {
  try {
    const { cohort_id, title } = req.body;
    if (!cohort_id || !title) {
      return next(new AppError("Поля cohort_id и title обязательны", 400, "BAD_REQUEST"));
    }

    const track = await trackService.createTrack({ cohort_id, title });
    return res.status(201).json(track);
  } catch (error) {
    return next(error);
  }
}

export async function getTracks(req: Request, res: Response, next: NextFunction) {
  try {
    let cohortId = req.cohortId;
    
    if (req.user?.role === UserRole.ADMIN && req.query.cohort_id) {
      cohortId = req.query.cohort_id as string;
    }

    if (!cohortId) {
      return next(new AppError("Контекст когорты не определен. Невозможно получить треки.", 400, "COHORT_CONTEXT_MISSING"));
    }

    const tracks = await trackService.getTracksByCohort(cohortId);
    return res.status(200).json(tracks);
  } catch (error) {
    return next(error);
  }
}