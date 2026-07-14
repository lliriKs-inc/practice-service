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

  async updateTrack(cohortId: string, trackId: string, title: string) {
    const track = await prisma.track.findFirst({ where: { id: trackId, cohort_id: cohortId } });
    if (!track) throw new AppError("Track not found", 404, "TRACK_NOT_FOUND");
    try {
      return await prisma.track.update({ where: { id: trackId }, data: { title: title.trim() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AppError("Track already exists in this cohort", 409, "TRACK_ALREADY_EXISTS");
      throw error;
    }
  }

  async deleteTrack(cohortId: string, trackId: string) {
    const track = await prisma.track.findFirst({ where: { id: trackId, cohort_id: cohortId }, include: { _count: { select: { applications: true } } } });
    if (!track) throw new AppError("Track not found", 404, "TRACK_NOT_FOUND");
    if (track._count.applications > 0) throw new AppError("Track with applications cannot be deleted", 409, "TRACK_HAS_APPLICATIONS");
    await prisma.track.delete({ where: { id: trackId } });
  }
}
