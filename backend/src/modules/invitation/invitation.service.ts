import crypto from "crypto";
import { CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";

export class InvitationService {
  async createInvitation(data: { cohort_id: string; expires_in_days: number }) {
    if (!Number.isInteger(data.expires_in_days) || data.expires_in_days <= 0) throw new AppError("expires_in_days must be a positive integer", 400, "INVALID_EXPIRATION");
    const cohort = await prisma.cohort.findUnique({ where: { id: data.cohort_id } });
    if (!cohort) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    if (cohort.status === CohortStatus.CLOSED) throw new AppError("Cohort is closed", 400, "COHORT_CLOSED");

    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000);
    return prisma.invitation.upsert({ where: { cohort_id: data.cohort_id }, update: { token, expires_at, created_at: new Date() }, create: { cohort_id: data.cohort_id, token, expires_at } });
  }

  async validateToken(token: string) {
    const invitation = await prisma.invitation.findUnique({ where: { token }, include: { cohort: true } });
    if (!invitation) throw new AppError("Invalid invitation token", 400, "INVALID_TOKEN");
    if (invitation.expires_at <= new Date()) throw new AppError("Invitation has expired", 400, "TOKEN_EXPIRED");
    if (invitation.cohort.status === CohortStatus.CLOSED) throw new AppError("Cohort is closed", 400, "COHORT_CLOSED");
    const now = new Date();
    if (invitation.cohort.application_start && now < invitation.cohort.application_start) throw new AppError("Application window is not open", 400, "APPLICATION_WINDOW_CLOSED");
    if (invitation.cohort.application_end && now > invitation.cohort.application_end) throw new AppError("Application window is closed", 400, "APPLICATION_WINDOW_CLOSED");
    return { valid: true, cohort_id: invitation.cohort_id, cohort_title: invitation.cohort.title };
  }

  async deleteInvitation(cohortId: string) {
    const invitation = await prisma.invitation.findUnique({ where: { cohort_id: cohortId } });
    if (!invitation) throw new AppError("Invitation not found", 404, "INVITATION_NOT_FOUND");
    await prisma.invitation.delete({ where: { cohort_id: cohortId } });
  }
}
