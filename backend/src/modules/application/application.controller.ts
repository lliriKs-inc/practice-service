import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { createApplicationSchema, updateApplicationStatusSchema } from "./dto/application.dto";
import { ApplicationService } from "./application.service";

const service = new ApplicationService();
const param = (req: Request, name: string) => { const value = req.params[name]; if (typeof value !== "string" || !value) throw new AppError("Invalid route parameter", 400, "VALIDATION_ERROR"); return value; };

export async function submitApplication(req: Request, res: Response, next: NextFunction) { try { if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED"); return res.status(201).json(await service.submitByInvitation(req.user.id, param(req, "token"), createApplicationSchema.parse(req.body))); } catch (error) { return next(error); } }
export async function listMine(req: Request, res: Response, next: NextFunction) { try { if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED"); return res.json(await service.listMine(req.user.id)); } catch (error) { return next(error); } }
export async function getMine(req: Request, res: Response, next: NextFunction) { try { if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED"); return res.json(await service.getMine(req.user.id, param(req, "applicationId"))); } catch (error) { return next(error); } }
export async function listForCohort(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.listForCohort(param(req, "cohortId"))); } catch (error) { return next(error); } }
export async function getForCohort(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.getForCohort(param(req, "cohortId"), param(req, "applicationId"))); } catch (error) { return next(error); } }
export async function updateStatus(req: Request, res: Response, next: NextFunction) { try { return res.json(await service.updateStatus(param(req, "cohortId"), param(req, "applicationId"), updateApplicationStatusSchema.parse(req.body), req.user?.id ?? null, req.requestId ?? null)); } catch (error) { return next(error); } }
