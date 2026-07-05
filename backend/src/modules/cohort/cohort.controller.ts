import { Request, Response } from "express";
import { CohortService } from "./cohort.service";
import { setActiveCohort, getActiveCohort } from "../../state/activeCohort";

const service = new CohortService();

export class CohortController {
  async create(req: Request, res: Response) {
    const cohort = await service.create(req.body);
    return res.json(cohort);
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

    setActiveCohort(userId, cohortId);

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

    const cohortId = getActiveCohort(userId);

    return res.json({
        activeCohortId: cohortId || null,
    });
    }
}