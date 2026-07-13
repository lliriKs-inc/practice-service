import { describe, expect, it } from "vitest";
import { createCohortSchema } from "./create-cohort.dto";

describe("createCohortSchema", () => {
  it("rejects invalid date ranges", () => {
    const result = createCohortSchema.safeParse({ title: "Test", practice_start: "2026-08-01", practice_end: "2026-07-01" });
    expect(result.success).toBe(false);
  });
});
