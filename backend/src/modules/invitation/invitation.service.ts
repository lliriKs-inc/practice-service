import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";
import * as crypto from "crypto";

export class InvitationService {
  async createInvitation(data: { cohort_id: string; expires_in_days: number }) {
    const cohort = await prisma.cohort.findUnique({ where: { id: data.cohort_id } });
    if (!cohort) {
      throw new AppError("Указанная когорта не найдена", 404, "COHORT_NOT_FOUND");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + data.expires_in_days);

    return prisma.invitation.upsert({
      where: { cohort_id: data.cohort_id },
      update: {
        token,
        expires_at,
        created_at: new Date(),
      },
      create: {
        cohort_id: data.cohort_id,
        token,
        expires_at,
      },
    });
  }

  async validateToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { cohort: true },
    });

    if (!invitation) {
      throw new AppError("Недействительный или несуществующий токен приглашения", 400, "INVALID_TOKEN");
    }

    if (new Date() > invitation.expires_at) {
      throw new AppError("Срок действия приглашения истек", 400, "TOKEN_EXPIRED");
    }

    if (invitation.cohort.status === "CLOSED") {
      throw new AppError("Когорта, привязанная к этому приглашению, уже закрыта", 400, "COHORT_CLOSED");
    }

    return {
      valid: true,
      cohort_id: invitation.cohort_id,
      cohort_title: invitation.cohort.title,
    };
  }
}