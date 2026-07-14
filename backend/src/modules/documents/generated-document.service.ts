import {
  ApplicationStatus,
  DocumentType,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import type { StorageService } from "../../shared/storage";
import { buildDocumentReadiness } from "./document-readiness.service";
import {
  DocumentGeneratorService,
  type DocumentTemplate,
} from "./documentGenerator.service";

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const documentTypeByTemplate: Record<
  DocumentTemplate,
  DocumentType
> = {
  "individual-task": DocumentType.INDIVIDUAL_TASK,
  review: DocumentType.REVIEW,
  "title-page": DocumentType.TITLE_PAGE,
  notice: DocumentType.NOTICE,
};

export class GeneratedDocumentService {
  constructor(
    private readonly storage: StorageService,
    private readonly generator = new DocumentGeneratorService()
  ) {}

  async generateMine(
    userId: string,
    applicationId: string,
    template: DocumentTemplate
  ) {
    const type = documentTypeByTemplate[template];
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.APPROVED,
      },
      select: {
        id: true,
        report: true,
        documents: {
          select: {
            id: true,
            type: true,
            generated_file_url: true,
            generated_at: true,
            fieldValues: {
              select: {
                field_key: true,
                value: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    const readiness = buildDocumentReadiness(
      application.documents,
      application.report
    ).find((item) => item.type === type);

    if (!readiness?.ready) {
      throw new AppError(
        "Document is not ready",
        400,
        "DOCUMENT_NOT_READY",
        readiness?.missingFields ?? []
      );
    }

    const values = Object.fromEntries(
      application.documents.flatMap((document) =>
        document.fieldValues.map((field) => [
          field.field_key,
          field.value,
        ])
      )
    );
    const buffer = this.generator.generate(template, values);
    const current = application.documents.find(
      (document) => document.type === type
    );
    const stored = await this.storage.replace({
      previousKey: current?.generated_file_url ?? null,
      file: {
        category: "generated-documents",
        content: buffer,
        originalName: `${template}.docx`,
        contentType: DOCX_CONTENT_TYPE,
      },
    });

    try {
      const document = await prisma.document.upsert({
        where: {
          application_id_type: {
            application_id: applicationId,
            type,
          },
        },
        update: {
          generated_file_url: stored.key,
          generated_at: new Date(),
        },
        create: {
          application_id: applicationId,
          type,
          generated_file_url: stored.key,
          generated_at: new Date(),
        },
      });

      return { buffer, document };
    } catch (error) {
      await this.storage.remove(stored.key);
      throw error;
    }
  }
}
