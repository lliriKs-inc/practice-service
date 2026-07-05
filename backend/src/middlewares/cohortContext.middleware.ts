import { Request, Response, NextFunction } from "express";
import { prisma } from "../shared/prisma";

export async function cohortContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;

  if (!userId) return next();

  const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { active_cohort_id: true },
  });

  req.cohortId = user?.active_cohort_id ?? null;

  next();
}