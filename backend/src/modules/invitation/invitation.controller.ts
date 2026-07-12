import { Request, Response, NextFunction } from "express";
import { InvitationService } from "./invitation.service";
import { AppError } from "../../middlewares/error.middleware";

const invitationService = new InvitationService();

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { cohort_id, expires_in_days } = req.body;
    if (!cohort_id) {
      return next(new AppError("Поле cohort_id обязательно", 400, "BAD_REQUEST"));
    }

    const days = expires_in_days ? parseInt(expires_in_days, 10) : 7;
    const invitation = await invitationService.createInvitation({ cohort_id, expires_in_days: days });
    
    return res.status(201).json(invitation);
  } catch (error) {
    return next(error);
  }
}

export async function validateInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;
    if (!token) {
      return next(new AppError("Токен приглашения обязателен для валидации", 400, "BAD_REQUEST"));
    }

    const result = await invitationService.validateToken(token);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}