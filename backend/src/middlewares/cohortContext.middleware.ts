import { Request, Response, NextFunction } from "express";
import { AppError } from "./error.middleware";

const COHORT_HEADER = "x-cohort-id";

export function cohortContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const routeCohortId =
    (typeof req.params.cohort_id === "string" && req.params.cohort_id) ||
    (typeof req.params.cohortId === "string" && req.params.cohortId);
  const headerCohortId = req.headers[COHORT_HEADER];
  const explicitCohortId =
    routeCohortId ||
    (typeof headerCohortId === "string" ? headerCohortId.trim() : undefined);

  req.cohortId = explicitCohortId || null;

  if (explicitCohortId && !req.user) {
    return next(new AppError("Authentication required", 401, "AUTH_REQUIRED"));
  }

  return next();
}
