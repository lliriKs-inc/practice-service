import { prisma } from "../../shared/prisma";

export class CohortRoleService {
  async create(cohortId: string, name: string) {
    return prisma.cohortRole.create({
        data: {
        cohort_id: cohortId,
        name,
        },
    });
 }

  async findAll(cohortId: string) {
    return prisma.cohortRole.findMany({
        where: { cohort_id: cohortId },
    });
  }
}