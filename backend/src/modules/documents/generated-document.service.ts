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
  documentTemplateByType,
} from "./documentGenerator.service";

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function practiceStageDates(start: Date, end: Date) {
  const weekdays: Date[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      weekdays.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const first = weekdays[0] ?? start;
  const last = weekdays.at(-1) ?? end;
  const beforeLast = weekdays.at(-2) ?? first;

  return {
    practice_stage1_finish: formatDate(first),
    practice_stage2_finish: formatDate(beforeLast),
    practice_stage3_start: formatDate(last),
  };
}

export class GeneratedDocumentService {
  constructor(
    private readonly storage: StorageService,
    private readonly generator = new DocumentGeneratorService()
  ) {}

  async generateMine(
    userId: string,
    applicationId: string,
    type: DocumentType
  ) {
    const template = documentTemplateByType[type];
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.APPROVED,
      },
      select: {
        id: true,
        user: {
          select: {
            full_name: true,
          },
        },
        track: {
          select: {
            title: true,
            cohort: {
              select: {
                title: true,
                practice_start: true,
                practice_end: true,
              },
            },
          },
        },
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

    const current = application.documents.find(
      (document) => document.type === type
    );
    const values = {
      ...Object.fromEntries(
        (current?.fieldValues ?? []).map((field) => [
          field.field_key,
          field.value,
        ])
      ),
      practice_start: formatDate(
        application.track.cohort.practice_start
      ),
      practice_end: formatDate(
        application.track.cohort.practice_end
      ),
      ...practiceStageDates(
        application.track.cohort.practice_start,
        application.track.cohort.practice_end
      ),
      year: application.track.cohort.practice_end
        .getUTCFullYear()
        .toString(),
      cohort_title: application.track.cohort.title,
      track_title: application.track.title,
      profile_full_name: application.user.full_name,
    };
    const buffer = this.generator.generate(template, values);
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
