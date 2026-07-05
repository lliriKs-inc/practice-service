import { prisma } from "../../shared/prisma";
import { CreateCohortDto } from "./dto/create-cohort.dto";

export class CohortService {
  async create(data: CreateCohortDto) {
    return prisma.cohort.create({
      data: {
        name: data.name,
        application_start: new Date(data.application_start),
        application_end: new Date(data.application_end),
        practice_start: new Date(data.practice_start),
        practice_end: new Date(data.practice_end),
      },
    });
  }

  async findAll() {
    return prisma.cohort.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.cohort.findUnique({
      where: { id },
    });
  }
}