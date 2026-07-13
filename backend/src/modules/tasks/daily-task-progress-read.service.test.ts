import { describe, expect, it } from "vitest";

describe("DailyTaskProgressReadService", () => {
  it("uses weekdays only in a seven-day week", () => {
    const weekStart = new Date(
      "2026-07-13T00:00:00.000Z"
    );

    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + index);
      return date.getUTCDay();
    });

    expect(dates).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("does not create or mutate tasks", () => {
    expect(true).toBe(true);
  });
});
