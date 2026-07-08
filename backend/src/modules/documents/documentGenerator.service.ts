import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type DocumentTemplate = "individual-task" | "review" | "title-page";

const templateFileByType: Record<DocumentTemplate, string> = {
  "individual-task": "individual-task.docx",
  review: "review.docx",
  "title-page": "title-page.docx",
};

export class DocumentGeneratorService {
  generate(type: DocumentTemplate, data: Record<string, string | number | boolean | null | undefined>) {
    const templatePath = path.resolve(
      __dirname,
      "../../../templates/documents",
      templateFileByType[type]
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