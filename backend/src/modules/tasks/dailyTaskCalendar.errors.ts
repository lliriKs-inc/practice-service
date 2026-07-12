export type DailyTaskCalendarErrorCode =
  | "DAILY_TASK_APPLICATION_NOT_FOUND"
  | "DAILY_TASK_APPLICATION_NOT_APPROVED"
  | "DAILY_TASK_INVALID_PRACTICE_PERIOD";

export class DailyTaskCalendarError extends Error {
  constructor(
    public readonly code: DailyTaskCalendarErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);

    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CalendarApplicationNotFoundError
  extends DailyTaskCalendarError {
  constructor() {
    super(
      "DAILY_TASK_APPLICATION_NOT_FOUND",
      "Application for daily task calendar was not found"
    );
  }
}

export class CalendarApplicationNotApprovedError
  extends DailyTaskCalendarError {
  constructor() {
    super(
      "DAILY_TASK_APPLICATION_NOT_APPROVED",
      "Daily task calendar requires an approved application"
    );
  }
}

export class InvalidPracticePeriodError
  extends DailyTaskCalendarError {
  constructor() {
    super(
      "DAILY_TASK_INVALID_PRACTICE_PERIOD",
      "Practice period is invalid"
    );
  }
}
