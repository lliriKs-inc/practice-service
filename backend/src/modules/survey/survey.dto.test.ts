import { describe, expect, it } from "vitest";
import { createQuestionSchema } from "./dto/survey.dto";

describe("survey DTOs", () => {
  it("accepts a required select question with unique options", () => {
    expect(createQuestionSchema.safeParse({ label: "Track", type: "SELECT", required: true, options: ["Backend", "Frontend"] }).success).toBe(true);
  });

  it("rejects invalid option combinations", () => {
    expect(createQuestionSchema.safeParse({ label: "Name", type: "TEXT", options: ["x"] }).success).toBe(false);
    expect(createQuestionSchema.safeParse({ label: "Track", type: "RADIO" }).success).toBe(false);
    expect(createQuestionSchema.safeParse({ label: "Track", type: "SELECT", options: ["Backend", "Backend"] }).success).toBe(false);
  });
});
