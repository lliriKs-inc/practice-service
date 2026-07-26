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

  it("reports exactly one issue when one or more options are left empty", () => {
    const oneEmpty = createQuestionSchema.safeParse({ label: "Track", type: "RADIO", options: ["Backend", ""] });
    expect(oneEmpty.success).toBe(false);
    if (!oneEmpty.success) {
      const optionsIssues = oneEmpty.error.issues.filter(i => i.path.join(".") === "options");
      expect(optionsIssues).toHaveLength(1);
      expect(optionsIssues[0].message).toBe("Option text cannot be empty");
    }

    const bothEmpty = createQuestionSchema.safeParse({ label: "Track", type: "RADIO", options: ["", ""] });
    expect(bothEmpty.success).toBe(false);
    if (!bothEmpty.success) {
      const optionsIssues = bothEmpty.error.issues.filter(i => i.path.join(".") === "options");
      expect(optionsIssues).toHaveLength(1);
    }
  });
});
