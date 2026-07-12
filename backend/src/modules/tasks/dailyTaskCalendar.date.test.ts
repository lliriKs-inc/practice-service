import {
  describe,
  expect,
  it,
} from "vitest";
import {
  InvalidPracticePeriodError,
} from "./dailyTaskCalendar.errors";
import {
  buildPracticeWeekdays,
} from "./dailyTaskCalendar.date";

function dates(values: Date[]): string[] {
  return values.map(
    (value) => value.toISOString().slice(0, 10)
  );
}

describe("buildPracticeWeekdays", () => {
  it("includes every weekday in an inclusive week", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-07-13T00:00:00.000Z"),
      new Date("2026-07-19T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });

  it("excludes a weekend at both period boundaries", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-07-11T00:00:00.000Z"),
      new Date("2026-07-19T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });

  it("returns one date for a single weekday", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-15T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2026-07-15",
    ]);
  });

  it("returns no dates for a single weekend day", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-07-18T00:00:00.000Z"),
      new Date("2026-07-18T00:00:00.000Z")
    );

    expect(result).toEqual([]);
  });

  it("supports a month boundary", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-07-30T00:00:00.000Z"),
      new Date("2026-08-03T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-03",
    ]);
  });

  it("supports a year boundary", () => {
    const result = buildPracticeWeekdays(
      new Date("2026-12-31T00:00:00.000Z"),
      new Date("2027-01-04T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-04",
    ]);
  });

  it("supports leap day without creating a weekend task", () => {
    const result = buildPracticeWeekdays(
      new Date("2024-02-28T00:00:00.000Z"),
      new Date("2024-03-01T00:00:00.000Z")
    );

    expect(dates(result)).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });

  it("normalizes time values without mutating inputs", () => {
    const start = new Date("2026-07-13T18:45:12.000Z");
    const end = new Date("2026-07-14T07:10:00.000Z");
    const originalStart = start.getTime();
    const originalEnd = end.getTime();

    const result = buildPracticeWeekdays(start, end);

    expect(dates(result)).toEqual([
      "2026-07-13",
      "2026-07-14",
    ]);
    expect(start.getTime()).toBe(originalStart);
    expect(end.getTime()).toBe(originalEnd);
  });

  it("rejects a reversed period", () => {
    expect(() =>
      buildPracticeWeekdays(
        new Date("2026-07-20T00:00:00.000Z"),
        new Date("2026-07-10T00:00:00.000Z")
      )
    ).toThrow(InvalidPracticePeriodError);
  });

  it("rejects an invalid date", () => {
    expect(() =>
      buildPracticeWeekdays(
        new Date("invalid"),
        new Date("2026-07-10T00:00:00.000Z")
      )
    ).toThrow(InvalidPracticePeriodError);
  });
});
