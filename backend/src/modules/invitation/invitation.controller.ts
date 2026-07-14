import { Request, Response, NextFunction } from "express";
import { InvitationService } from "./invitation.service";
import { createInvitationSchema, validateInvitationSchema } from "./dto/create-invitation.dto";
import { AppError } from "../../middlewares/error.middleware";

const invitationService = new InvitationService();

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createInvitationSchema.safeParse(req.body);
    if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
    return res.status(201).json(await invitationService.createInvitation(parsed.data));
  } catch (error) { return next(error); }
}

export async function validateInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validateInvitationSchema.safeParse(req.body);
    if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
    return res.status(200).json(await invitationService.validateToken(parsed.data.token));
  } catch (error) { return next(error); }
}

export async function createCohortInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const expires_in_days = req.body?.expires_in_days ?? 7;
    const parsed = createInvitationSchema.safeParse({ cohort_id: String(req.params.cohortId), expires_in_days });
    if (!parsed.success) return next(new AppError("Request validation failed", 400, "VALIDATION_ERROR", parsed.error.issues));
    return res.status(201).json(await invitationService.createInvitation(parsed.data));
  } catch (error) { return next(error); }
}

export async function deleteCohortInvitation(req: Request, res: Response, next: NextFunction) {
  try { await invitationService.deleteInvitation(String(req.params.cohortId)); return res.status(204).send(); } catch (error) { return next(error); }
}
