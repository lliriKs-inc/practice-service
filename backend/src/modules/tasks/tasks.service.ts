import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

export class TasksService {
  async ensureApprovedApplication(userId: string, cohortId: string) {
    const application = await prisma.application.findFirst({
      where: {
        user_id: userId,
        cohort_id: cohortId,
        status: "APPROVED",
      },
    });

    if (!application) {
      throw new AppError("Application not approved", 403);
    }
  }

  async getCohort(cohortId: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      throw new AppError("Cohort not found", 404);
    }

    return cohort;
  }

  async ensureDateInsidePractice(cohortId: string, date: Date) {
    const cohort = await this.getCohort(cohortId);

    if (date < cohort.practice_start || date > cohort.practice_end) {
      throw new AppError("Task date is outside practice period", 400);
    }
  }

  async create(userId: string, cohortId: string, data: CreateTaskDto) {
    await this.ensureApprovedApplication(userId, cohortId);

    const date = new Date(data.date);

    if (Number.isNaN(date.getTime())) {
      throw new AppError("Invalid task date", 400);
    }

    await this.ensureDateInsidePractice(cohortId, date);

    return prisma.taskCard.create({
      data: {
        user_id: userId,
        cohort_id: cohortId,
        date,
        title: data.title,
        description: data.description,
        artifact_link: data.artifact_link,
      },
    });
  }

  async findMine(userId: string, cohortId: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    return prisma.taskCard.findMany({
      where: {
        user_id: userId,
        cohort_id: cohortId,
      },
      orderBy: {
        date: "asc",
      },
    });
  }

  async findWeek(userId: string, cohortId: string, weekStart: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    const start = new Date(weekStart);

    if (Number.isNaN(start.getTime())) {
      throw new AppError("Invalid weekStart", 400);
    }

    const cohort = await this.getCohort(cohortId);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const tasks = await prisma.taskCard.findMany({
      where: {
        user_id: userId,
        cohort_id: cohortId,
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return {
      weekStart: start,
      weekEnd: end,
      practiceStart: cohort.practice_start,
      practiceEnd: cohort.practice_end,
      tasks,
    };
  }

  async findAllWeek(cohortId: string, weekStart: string) {
    const start = new Date(weekStart);

    if (Number.isNaN(start.getTime())) {
      throw new AppError("Invalid weekStart", 400);
    }

    const cohort = await this.getCohort(cohortId);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const tasks = await prisma.taskCard.findMany({
      where: {
        cohort_id: cohortId,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { updated_at: "desc" },
      ],
    });

    return {
      weekStart: start,
      weekEnd: end,
      practiceStart: cohort.practice_start,
      practiceEnd: cohort.practice_end,
      tasks,
    };
  }

  async update(userId: string, cohortId: string, taskId: string, data: UpdateTaskDto) {
    await this.ensureApprovedApplication(userId, cohortId);

    const task = await prisma.taskCard.findFirst({
      where: {
        id: taskId,
        user_id: userId,
        cohort_id: cohortId,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const updateData = {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    };

    if (updateData.date) {
      if (Number.isNaN(updateData.date.getTime())) {
        throw new AppError("Invalid task date", 400);
      }

      await this.ensureDateInsidePractice(cohortId, updateData.date);
    }

    return prisma.taskCard.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  async delete(userId: string, cohortId: string, taskId: string) {
    await this.ensureApprovedApplication(userId, cohortId);

    const task = await prisma.taskCard.findFirst({
      where: {
        id: taskId,
        user_id: userId,
        cohort_id: cohortId,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    await prisma.taskCard.delete({
      where: { id: taskId },
    });

    return { message: "Task deleted" };
  }

  async findAll(cohortId: string) {
    return prisma.taskCard.findMany({
      where: {
        cohort_id: cohortId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { updated_at: "desc" },
      ],
    });
  }
}