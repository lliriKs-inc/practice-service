import { describe, expect, it } from "vitest";
import { DocumentGeneratorService } from "./documentGenerator.service";

describe("document showcase", () => {
  it("generates every supported document type", () => {
    const generator = new DocumentGeneratorService();

    for (const type of [
      "individual-task",
      "review",
      "title-page",
      "notice",
    ] as const) {
      const buffer = generator.generate(type, {
        student_name: "Demo Student",
        practice_title: "Practice",
        review_grade: "A",
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 2).toString()).toBe("PK");
    }
  });
});
