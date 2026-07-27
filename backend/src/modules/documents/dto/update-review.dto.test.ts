import { describe, expect, it } from "vitest";
import { UpdateReviewSchema } from "./update-review.dto";

describe("UpdateReviewSchema review grade", () => {
  it.each(["0", "5", "10"])("accepts %s", (review_grade) => {
    expect(UpdateReviewSchema.safeParse({ review_grade }).success).toBe(true);
  });

  it.each(["-1", "11", "5.5"])("rejects %s", (review_grade) => {
    expect(UpdateReviewSchema.safeParse({ review_grade }).success).toBe(false);
  });
});
