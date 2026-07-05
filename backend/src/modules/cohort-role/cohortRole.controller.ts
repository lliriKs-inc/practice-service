import { Request, Response } from "express";
import { CohortRoleService } from "./cohortRole.service";

const service = new CohortRoleService();

export class CohortRoleController {
  async create(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.cohortId) {
        return res.status(400).json({ message: "No active cohort selected" });
    }

    const role = await service.create(
        req.cohortId,
        req.body.name
    );

    return res.json(role);
 }

  async getAll(req: Request, res: Response) {
    const cohortId = req.cohortId;
    if (!req.cohortId) {
    return res.status(400).json({ message: "No active cohort selected" });
    }

    const roles = await service.findAll(req.cohortId);

    res.json(roles);
  }
}