import { describe, expect, it } from "vitest";
import { normalizeUploadedFilename } from "./filename";

describe("normalizeUploadedFilename", () => {
  it("decodes a UTF-8 Cyrillic filename exposed as Latin-1 by multipart parsing", () => {
    const originalName = "Индивидуальное задание.docx";
    const mojibake = Buffer.from(originalName, "utf8").toString("latin1");

    expect(normalizeUploadedFilename(mojibake)).toBe(originalName);
  });

  it("keeps an already-correct Unicode filename unchanged", () => {
    expect(normalizeUploadedFilename("Индивидуальное задание.docx"))
      .toBe("Индивидуальное задание.docx");
  });
});
