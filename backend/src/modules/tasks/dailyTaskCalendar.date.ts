import {
  InvalidPracticePeriodError,
} from "./dailyTaskCalendar.errors";

const SATURDAY = 6;
const SUNDAY = 0;

function toUtcDateOnly(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new InvalidPracticePeriodError();
  }

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    )
  );
}

function isWeekday(value: Date): boolean {
  const weekday = value.getUTCDay();

  return weekday !== SATURDAY && weekday !== SUNDAY;
}

export function buildPracticeWeekdays(
  practiceStart: Date,
  practiceEnd: Date
): Date[] {
  const start = toUtcDateOnly(practiceStart);
  const end = toUtcDateOnly(practiceEnd);

  if (start.getTime() > end.getTime()) {
    throw new InvalidPracticePeriodError();
  }

  const weekdays: Date[] = [];
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    if (isWeekday(current)) {
      weekdays.push(new Date(current));
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return weekdays;
}
