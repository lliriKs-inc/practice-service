import { describe, expect, it } from "vitest";
import { DocumentGeneratorService } from "./documentGenerator.service";

describe("DocumentGeneratorService", () => {
  const generator = new DocumentGeneratorService();

  it.each([
    "individual-task",
    "review",
    "title-page",
    "notice",
  ] as const)("generates a DOCX buffer for %s", (template) => {
    const result = generator.generate(template, {
      student_name: "Test Student",
      title: "Practice document",
      review_grade: "A",
    });

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.subarray(0, 2).toString()).toBe("PK");
    expect(result.length).toBeGreaterThan(1000);
  });

  it("rejects an unsupported template", () => {
    expect(() =>
      generator.generate("unsupported" as never, {}),
    ).toThrow("Unsupported document template");
  });
});
