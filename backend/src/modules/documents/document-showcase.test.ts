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
        student_fio: "Demo Student",
        group: "G-1",
        direction_code: "09.03.01",
        direction_name: "Computer science",
        program_name: "Software engineering",
        specialty: "Computer science",
        practice_topic: "Practice",
        main_stage_tasks: "Build and verify",
        practice_start: "01.07.2026",
        practice_end: "31.07.2026",
        practice_stage1_finish: "01.07.2026",
        practice_stage2_finish: "30.07.2026",
        practice_stage3_start: "31.07.2026",
        review_activities: "Backend work",
        review_characteristic: "Responsible",
        review_employed: "No",
        review_next_practice: "Yes",
        review_employment_offer: "Yes",
        review_suggestions: "None",
        review_grade: "A",
        year: "2026",
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 2).toString()).toBe("PK");
    }
  });
});
