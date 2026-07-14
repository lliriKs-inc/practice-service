import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { AdminService } from "./admin.service";
import { adminApplicationsQuerySchema } from "./dto/admin-applications-query.dto";
import { adminDocumentsQuerySchema } from "./dto/admin-documents-query.dto";

function param(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string" || !value) {
    throw new AppError(
      `Invalid ${name}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  return value;
}

export class AdminController {
  constructor(private readonly service = new AdminService()) {}

  async getApplications(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.service.getApplications(
        param(req, "cohortId"),
        adminApplicationsQuerySchema.parse(req.query)
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getApplication(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.service.getApplication(
        param(req, "cohortId"),
        param(req, "applicationId")
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.service.getDocuments(
        param(req, "cohortId"),
        adminDocumentsQuerySchema.parse(req.query)
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getApplicationDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.service.getApplicationDocuments(
        param(req, "cohortId"),
        param(req, "applicationId")
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getOverview(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.service.getOverview(
        param(req, "cohortId")
      );

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}
