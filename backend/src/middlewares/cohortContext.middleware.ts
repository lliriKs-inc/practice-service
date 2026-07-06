// backend/src/middlewares/cohortContext.middleware.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../shared/prisma";

export async function cohortContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;

  if (!userId) return next();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { active_cohort_id: true },
    });

    req.cohortId = user?.active_cohort_id ?? null;
    
    next();
  } catch (error) {
    console.error("[Database Error] Ошибка в cohortContextMiddleware при чтении БД:", error);

    return res.status(500).json({
      success: false,
      message: "Внутренняя ошибка сервера при обработке контекста когорты",
    });
  }
}