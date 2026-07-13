import { describe, expect, it } from "vitest";
import { createApplicationSchema, updateApplicationStatusSchema } from "./dto/application.dto";

describe("application DTOs", () => {
  it("requires track and answer question IDs", () => {
    expect(createApplicationSchema.safeParse({ track_id: "track-1", answers: [{ question_id: "q-1", answer_value: "answer" }] }).success).toBe(true);
    expect(createApplicationSchema.safeParse({ track_id: "track-1", answers: [{ question_id: "", answer_value: "answer" }] }).success).toBe(false);
  });

  it("requires a rejection reason for rejected applications", () => {
    expect(updateApplicationStatusSchema.safeParse({ status: "REJECTED" }).success).toBe(false);
    expect(updateApplicationStatusSchema.safeParse({ status: "REJECTED", rejection_reason: "Reason" }).success).toBe(true);
    expect(updateApplicationStatusSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
  });
});
