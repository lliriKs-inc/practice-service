import {
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";

function parseUtcDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(
      "Invalid weekStart",
      400,
      "INVALID_WEEK_START"
    );
  }

  return date;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function buildWeekdays(weekStart: Date): Date[] {
  const days: Date[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addUtcDays(weekStart, offset);

    if (!isWeekend(date)) {
      days.push(date);
    }
  }

  return days;
}

function normalizeWeekStart(value: Date): Date {
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  return addUtcDays(value, mondayOffset);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const taskInclude = {
  links: {
    orderBy: {
      id: "asc" as const,
    },
  },
} satisfies Prisma.DailyTaskInclude;

export class DailyTaskProgressReadService {
  async getMine(
    userId: string,
    applicationId: string,
    weekStartValue: string
  ) {
    const requestedWeekStart = parseUtcDateOnly(weekStartValue);
    const weekStart = normalizeWeekStart(requestedWeekStart);
    const weekEnd = addUtcDays(weekStart, 6);
    const weekdays = buildWeekdays(weekStart);

    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.APPROVED,
      },
      select: {
        id: true,
        track: {
          select: {
            id: true,
            title: true,
            cohort: {
              select: {
                id: true,
                title: true,
                practice_start: true,
                practice_end: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    const tasks = await prisma.dailyTask.findMany({
      where: {
        application_id: application.id,
        task_date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: taskInclude,
      orderBy: {
        task_date: "asc",
      },
    });

    const tasksByDate = new Map(
      tasks.map((task) => [formatDate(task.task_date), task])
    );

    return {
      applicationId: application.id,
      cohort: application.track.cohort,
      track: {
        id: application.track.id,
        title: application.track.title,
      },
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      days: weekdays.map((date) => ({
        date: formatDate(date),
        task: tasksByDate.get(formatDate(date)) ?? null,
      })),
    };
  }

  async getCohort(
    cohortId: string,
    weekStartValue: string
  ) {
    const requestedWeekStart = parseUtcDateOnly(weekStartValue);
    const weekStart = normalizeWeekStart(requestedWeekStart);
    const weekEnd = addUtcDays(weekStart, 6);
    const weekdays = buildWeekdays(weekStart);

    const cohort = await prisma.cohort.findUnique({
      where: {
        id: cohortId,
      },
      select: {
        id: true,
        title: true,
        practice_start: true,
        practice_end: true,
        tracks: {
          select: {
            id: true,
            title: true,
            applications: {
              where: {
                status: ApplicationStatus.APPROVED,
              },
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                  },
                },
                dailyTasks: {
                  where: {
                    task_date: {
                      gte: weekStart,
                      lte: weekEnd,
                    },
                  },
                  include: taskInclude,
                  orderBy: {
                    task_date: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cohort) {
      throw new AppError(
        "Cohort not found",
        404,
        "COHORT_NOT_FOUND"
      );
    }

    return {
      cohort: {
        id: cohort.id,
        title: cohort.title,
        practiceStart: cohort.practice_start,
        practiceEnd: cohort.practice_end,
      },
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      days: weekdays.map((date) => formatDate(date)),
      students: cohort.tracks.flatMap((track) =>
        track.applications.map((application) => {
          const tasksByDate = new Map(
            application.dailyTasks.map((task) => [
              formatDate(task.task_date),
              task,
            ])
          );

          return {
            applicationId: application.id,
            student: application.user,
            track: {
              id: track.id,
              title: track.title,
            },
            tasks: weekdays.map((date) => ({
              date: formatDate(date),
              task: tasksByDate.get(formatDate(date)) ?? null,
            })),
          };
        })
      ),
    };
  }
  async getMissed(
    cohortId: string,
    weekStartValue: string,
    studentId?: string
  ) {
    const requestedWeekStart = parseUtcDateOnly(
      weekStartValue
    );

    const weekStart = normalizeWeekStart(
      requestedWeekStart
    );

    const weekEnd = addUtcDays(weekStart, 6);

    const now = new Date();

    const todayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      )
    );

    const effectiveEnd =
      weekEnd.getTime() < todayUtc.getTime()
        ? weekEnd
        : todayUtc;

    if (effectiveEnd.getTime() < weekStart.getTime()) {
      return {
        cohortId,
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEnd),
        missed: [],
      };
    }

    const applications =
      await prisma.application.findMany({
        where: {
          status: ApplicationStatus.APPROVED,
          track: {
            cohort_id: cohortId,
          },
          ...(studentId
            ? {
                user_id: studentId,
              }
            : {}),
        },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
          track: {
            select: {
              id: true,
              title: true,
            },
          },
          dailyTasks: {
            where: {
              task_date: {
                gte: weekStart,
                lte: effectiveEnd,
              },
              description: null,
            },
            include: {
              links: {
                orderBy: {
                  id: "asc",
                },
              },
            },
            orderBy: {
              task_date: "asc",
            },
          },
        },
      });

    return {
      cohortId,
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      missed: applications.flatMap((application) =>
        application.dailyTasks.map((task) => ({
          applicationId: application.id,
          taskId: task.id,
          taskDate: formatDate(task.task_date),
          student: application.user,
          track: application.track,
          links: task.links,
        }))
      ),
    };
  }
}
