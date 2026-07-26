import { describe, expect, it } from "vitest";
import { DocumentType } from "@prisma/client";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import { getDocumentConfig } from "./document.config";
import { DocumentGeneratorService } from "./documentGenerator.service";

describe("DocumentGeneratorService", () => {
  const generator = new DocumentGeneratorService();
  const completeData = {
    student_fio: "Иван Иванов",
    group: "РИ-420001",
    course: "4",
    institute_abbr: "ИРИТ-РТФ",
    direction_code: "09.03.01",
    direction_name: "Информатика и вычислительная техника",
    specialty: "09.03.01 Информатика и вычислительная техника",
    program_name: "Программная инженерия",
    practice_type: "Производственная практика, технологическая",
    practice_type_short: "Производственная практика",
    practice_topic: "Разработка сервиса практики",
    main_stage_tasks: "Реализация и тестирование API",
    practice_start: "01.07.2026",
    practice_end: "31.07.2026",
    practice_stage1_finish: "01.07.2026",
    practice_stage2_finish: "30.07.2026",
    practice_stage3_start: "31.07.2026",
    practice_start_day: "1",
    practice_start_month: "июля",
    practice_start_year_short: "26",
    practice_end_day: "31",
    practice_end_month: "июля",
    practice_end_year: "2026",
    student_fio_genitive: "Иванова Ивана Ивановича",
    student_fio_initials: "Иванов И.И.",
    review_activities: "Разрабатывал backend",
    review_characteristic: "Ответственный практикант",
    review_employed: "Нет",
    review_next_practice: "Да",
    review_employment_offer: "Да",
    review_suggestions: "Продолжить развитие проекта",
    review_grade: "Отлично",
    year: "2026",
  };
  const templateCases = [
    [DocumentType.INDIVIDUAL_TASK, "individual-task.docx"],
    [DocumentType.TITLE_PAGE, "title-page.docx"],
    [DocumentType.REVIEW, "review.docx"],
    [DocumentType.NOTICE, "notice.docx"],
  ] as const;

  it.each([
    "individual-task",
    "review",
    "title-page",
    "notice",
  ] as const)("generates a DOCX buffer for %s", (template) => {
    const result = generator.generate(template, completeData);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.subarray(0, 2).toString()).toBe("PK");
    expect(result.length).toBeGreaterThan(1000);

    const xml = new PizZip(result)
      .file("word/document.xml")
      ?.asText();
    expect(xml).toBeDefined();
    expect(xml).not.toContain("{{");
    expect(xml).not.toContain("undefined");
    expect(xml).toContain("Иван Иванов");
  });

  it("rejects an unsupported template", () => {
    expect(() =>
      generator.generate("unsupported" as never, {}),
    ).toThrow("Unsupported document template");
  });

  it.each(templateCases)(
    "%s config contains every editable template placeholder",
    (type, filename) => {
      const buffer = fs.readFileSync(
        path.resolve(__dirname, `../../../templates/documents/${filename}`)
      );
      const xml = new PizZip(buffer)
        .file("word/document.xml")
        ?.asText() ?? "";
      const plainText = xml.replace(/<[^>]+>/g, "");
      const placeholders = [...plainText.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
        .map((match) => match[1].trim());
      const systemFields = new Set([
        "practice_start",
        "practice_end",
        "practice_stage1_finish",
        "practice_stage2_finish",
        "practice_stage3_start",
        "practice_start_day",
        "practice_start_month",
        "practice_start_year_short",
        "practice_end_day",
        "practice_end_month",
        "practice_end_year",
        "student_fio_genitive",
        "student_fio_initials",
        "practice_type_short",
        "course",
        "year",
      ]);
      // review_grade заполняется куратором в отзыве, но на титульном листе и
      // извещении это просто подставленное системой значение, а не своё поле.
      if (type !== DocumentType.REVIEW) {
        systemFields.add("review_grade");
      }
      const editablePlaceholders = [...new Set(
        placeholders.filter((field) => !systemFields.has(field))
      )].sort();
      const configuredFields = getDocumentConfig(type).fields
        .map(({ key }) => key)
        .sort();

      expect(editablePlaceholders).toEqual(configuredFields);
    }
  );
});
