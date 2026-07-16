import { DocumentType } from "@prisma/client";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type DocumentTemplate =
  | "individual-task"
  | "review"
  | "title-page"
  | "notice";

const templateFileByType: Record<DocumentTemplate, string> = {
  "individual-task": "individual-task.docx",
  review: "review.docx",
  "title-page": "title-page.docx",
  notice: "notice.docx",
};

export const documentTemplateByType: Record<
  DocumentType,
  DocumentTemplate
> = {
  [DocumentType.INDIVIDUAL_TASK]: "individual-task",
  [DocumentType.TITLE_PAGE]: "title-page",
  [DocumentType.REVIEW]: "review",
  [DocumentType.NOTICE]: "notice",
};

export class DocumentGeneratorService {
  generate(type: DocumentTemplate, data: Record<string, string | number | boolean | null | undefined>) {
    const templateFile = templateFileByType[type];

    if (!templateFile) {
      throw new Error(`Unsupported document template: ${type}`);
    }

    const templatePath = path.resolve(
      __dirname,
      "../../../templates/documents",
      templateFile
    );

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: "{{",
      end: "}}",
    },
  });

    doc.render(data);

    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  }
}
