import { prisma } from "../../shared/prisma";
import { getActiveCohort } from "../../state/activeCohort";

export class CohortRoleService {
  async create(userId: string, name: string) {
    const cohortId = getActiveCohort(userId);

    if (!cohortId) {
      throw new Error("No active cohort selected");
    }

    return prisma.cohortRole.create({
      data: {
        cohort_id: cohortId,
        name,
      },
    });
  }

  async findAll(userId: string) {
    const cohortId = getActiveCohort(userId);

    return prisma.cohortRole.findMany({
      where: {
        cohort_id: cohortId,
      },
    });
  }
}