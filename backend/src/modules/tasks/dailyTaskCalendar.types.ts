import type {
  Prisma,
} from "@prisma/client";

export interface DailyTaskCalendarResult {
  applicationId: string;
  expectedTaskCount: number;
  createdTaskCount: number;
}

export interface DailyTaskCalendarServiceContract {
  ensureForApprovedApplication(
    applicationId: string,
    transaction: Prisma.TransactionClient
  ): Promise<DailyTaskCalendarResult>;
}
