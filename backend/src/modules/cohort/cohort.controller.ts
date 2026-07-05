import { Request, Response } from "express";
import { CohortService } from "./cohort.service";

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
}