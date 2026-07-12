import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";

export class TrackService {
  async createTrack(data: { cohort_id: string; title: string }) {
    const cohort = await prisma.cohort.findUnique({ where: { id: data.cohort_id } });
    if (!cohort) {
      throw new AppError("Указанная когорта не найдена", 404, "COHORT_NOT_FOUND");
    }

    return prisma.track.create({
      data: {
        cohort_id: data.cohort_id,
        title: data.title,
      },
    });
  }

  async getTracksByCohort(cohortId: string) {
    return prisma.track.findMany({
      where: { cohort_id: cohortId },
    });
  }
}