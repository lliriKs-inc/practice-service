import { Request, Response, NextFunction } from "express";
import { getActiveCohort } from "../state/activeCohort";

export function cohortContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;

  if (!userId) return next();

  const cohortId = getActiveCohort(userId);

  req.cohortId = cohortId || null;

  next();
}