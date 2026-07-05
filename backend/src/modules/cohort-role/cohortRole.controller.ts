import { Request, Response } from "express";
import { CohortRoleService } from "./cohortRole.service";

const service = new CohortRoleService();

export class CohortRoleController {
  async create(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const role = await service.create(
      req.user.id,
      req.body.name
    );

    res.json(role);
  }

  async getAll(req: Request, res: Response) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const roles = await service.findAll(req.user.id);

    res.json(roles);
  }
}