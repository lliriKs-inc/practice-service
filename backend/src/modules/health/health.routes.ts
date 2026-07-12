import { Router } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";

export type ReadinessCheck = () => Promise<void>;

async function checkDatabaseReadiness(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export function createHealthRouter(
  readinessCheck: ReadinessCheck = checkDatabaseReadiness
) {
  const router = Router();

  router.get("/health", (req, res) => {
    return res.status(200).json({
      status: "ok",
      requestId: req.requestId ?? null,
    });
  });

  router.get("/ready", async (req, res, next) => {
    try {
      await readinessCheck();

      return res.status(200).json({
        status: "ready",
        checks: {
          database: "ok",
        },
        requestId: req.requestId ?? null,
      });
    } catch {
      return next(
        new AppError(
          "Service is not ready",
          503,
          "SERVICE_NOT_READY",
          {
            database: "unavailable",
          }
        )
      );
    }
  });

  return router;
}