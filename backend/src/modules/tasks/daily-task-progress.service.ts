import {
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import type { UpdateDailyTaskDto } from "./dto/update-daily-task.dto";

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

export class DailyTaskProgressService {
  async updateMine(
    userId: string,
    taskId: string,
    dto: UpdateDailyTaskDto
  ) {
    return prisma.$transaction(async (tx) => {
      const task = await tx.dailyTask.findFirst({
        where: {
          id: taskId,
          application: {
            user_id: userId,
            status: ApplicationStatus.APPROVED,
          },
        },
        select: {
          id: true,
          task_date: true,
        },
      });

      if (!task) {
        throw new AppError(
          "Daily task not found",
          404,
          "DAILY_TASK_NOT_FOUND"
        );
      }

      if (isWeekend(task.task_date)) {
        throw new AppError(
          "Weekend daily task cannot be edited",
          400,
          "DAILY_TASK_WEEKEND_EDIT_FORBIDDEN"
        );
      }

      await tx.dailyTask.update({
        where: {
          id: task.id,
        },
        data: {
          description:
            dto.description === null || dto.description === ""
              ? null
              : dto.description,
          saved_at: new Date(),
        },
      });

      await tx.dailyTaskLink.deleteMany({
        where: {
          daily_task_id: task.id,
        },
      });

      if (dto.links.length > 0) {
        await tx.dailyTaskLink.createMany({
          data: dto.links.map((link) => ({
            daily_task_id: task.id,
            url: link.url,
          })),
        });
      }

      return tx.dailyTask.findUnique({
        where: {
          id: task.id,
        },
        include: {
          links: {
            orderBy: {
              id: "asc",
            },
          },
        },
      });
    });
  }
}
