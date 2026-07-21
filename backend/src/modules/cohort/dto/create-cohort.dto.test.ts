import { describe, expect, it } from "vitest";
import { createCohortSchema } from "./create-cohort.dto";
import { updateCohortSchema } from "./update-cohort.dto";

describe("createCohortSchema", () => {
  it("rejects invalid date ranges", () => {
    const result = createCohortSchema.safeParse({ title: "Test", practice_start: "2026-08-01", practice_end: "2026-07-01" });
    expect(result.success).toBe(false);
  });

  it.each(["111111-02-11", "125125-03-12", "+275760-04-14", "1999-12-31", "2101-01-01"])(
    "rejects an out-of-range cohort date: %s",
    (date) => {
      const result = createCohortSchema.safeParse({
        title: "Test",
        application_start: "2026-01-01",
        application_end: "2026-01-31",
        practice_start: date,
        practice_end: "2026-02-28",
      });

      expect(result.success).toBe(false);
    },
  );

  it("accepts dates inside the supported range", () => {
    const result = createCohortSchema.safeParse({
      title: "Test",
      application_start: "2026-01-01",
      application_end: "2026-01-31",
      practice_start: "2026-02-01",
      practice_end: "2026-02-28",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range date when updating a cohort", () => {
    const result = updateCohortSchema.safeParse({
      practice_end: "125125-03-12",
    });

    expect(result.success).toBe(false);
  });
});
