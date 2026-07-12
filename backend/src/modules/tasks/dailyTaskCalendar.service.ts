import {
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import {
  CalendarApplicationNotApprovedError,
  CalendarApplicationNotFoundError,
} from "./dailyTaskCalendar.errors";
import {
  buildPracticeWeekdays,
} from "./dailyTaskCalendar.date";
import type {
  DailyTaskCalendarResult,
  DailyTaskCalendarServiceContract,
} from "./dailyTaskCalendar.types";

export class DailyTaskCalendarService
  implements DailyTaskCalendarServiceContract {
  async ensureForApprovedApplication(
    applicationId: string,
    transaction: Prisma.TransactionClient
  ): Promise<DailyTaskCalendarResult> {
    const application =
      await transaction.application.findUnique({
        where: {
          id: applicationId,
        },
        select: {
          status: true,
          track: {
            select: {
              cohort: {
                select: {
                  practice_start: true,
                  practice_end: true,
                },
              },
            },
          },
        },
      });

    if (!application) {
      throw new CalendarApplicationNotFoundError();
    }

    if (application.status !== ApplicationStatus.APPROVED) {
      throw new CalendarApplicationNotApprovedError();
    }

    const weekdays = buildPracticeWeekdays(
      application.track.cohort.practice_start,
      application.track.cohort.practice_end
    );

    if (weekdays.length === 0) {
      return {
        applicationId,
        expectedTaskCount: 0,
        createdTaskCount: 0,
      };
    }

    const result =
      await transaction.dailyTask.createMany({
        data: weekdays.map((taskDate) => ({
          application_id: applicationId,
          task_date: taskDate,
        })),
        skipDuplicates: true,
      });

    return {
      applicationId,
      expectedTaskCount: weekdays.length,
      createdTaskCount: result.count,
    };
  }
}
