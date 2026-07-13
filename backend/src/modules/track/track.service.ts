import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { AppError } from "../../middlewares/error.middleware";

export class TrackService {
  async createTrack(data: { cohort_id: string; title: string }) {
    const cohort = await prisma.cohort.findUnique({ where: { id: data.cohort_id } });
    if (!cohort) throw new AppError("Cohort not found", 404, "COHORT_NOT_FOUND");
    try {
      return await prisma.track.create({ data: { cohort_id: data.cohort_id, title: data.title.trim() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("Track already exists in this cohort", 409, "TRACK_ALREADY_EXISTS");
      throw error;
    }
  }

  async getTracksByCohort(cohortId: string) {
    return prisma.track.findMany({ where: { cohort_id: cohortId } });
  }
}
