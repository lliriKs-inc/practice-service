import { Request, Response } from "express";
import { CohortService } from "./cohort.service";
import { prisma } from "../../shared/prisma";

const service = new CohortService();

export class CohortController {
  async create(req: Request, res: Response) {
    const cohort = await service.create(req.body);
    return res.json(cohort);
  }

  async update(req: Request<{ id: string }>, res: Response) {
    const updated = await service.update(
        req.params.id,
        req.body
    );

    res.json(updated);
  }

  async getAll(req: Request, res: Response) {
    const cohorts = await service.findAll();
    return res.json(cohorts);
  }

  async getById(req: Request<{ id: string }>, res: Response) {
    const cohort = await service.findById(req.params.id);
    return res.json(cohort);
  }

  async activate(req: Request<{ id: string }>, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const cohortId = req.params.id;
    const cohort = await prisma.cohort.findUnique({
        where: { id: cohortId },
    });

    if (!cohort) {
        return res.status(404).json({
        message: "Cohort not found",
        });
    }
    
    await prisma.user.update({
        where: { id: userId },
        data: { active_cohort_id: cohortId },
    });

    return res.json({
        message: "active cohort set",
        cohortId,
    });
  }
  async getActive(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { active_cohort_id: true },
    });

    const cohortId = user?.active_cohort_id ?? null;

    return res.json({
        activeCohortId: cohortId || null,
    });
    }
}