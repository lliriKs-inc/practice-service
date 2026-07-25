import {
  ApplicationStatus,
  DocumentType,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import type { StorageService } from "../../shared/storage";
import { buildDocumentReadiness } from "./document-readiness.service";
import { toGenitive, toInitials } from "../../shared/name-declension";
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

const MONTHS_RU_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// Для бланков вида «29 июня 20 26» — день/месяц/последние 2 цифры года
// отдельными тегами, чтобы в шаблоне можно было подчеркнуть только их.
function formatDateParts(value: Date) {
  return {
    day: String(value.getUTCDate()),
    month: MONTHS_RU_GENITIVE[value.getUTCMonth()],
    year_short: String(value.getUTCFullYear()).slice(-2),
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Границы организационного/заключительного этапов зависят от того, сколько
// длится практика целиком — чем длиннее практика, тем шире эти этапы.
function stageOffsetDays(durationDays: number): number {
  if (durationDays <= 7) return 0;
  if (durationDays <= 14) return 2;
  if (durationDays <= 21) return 4;
  return 7;
}

function practiceStageDates(start: Date, end: Date) {
  const durationDays =
    Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const offset = stageOffsetDays(durationDays);

  const organizationalEnd = addDays(start, offset);
  const finalStart = addDays(end, -offset);
  const mainEnd = addDays(finalStart, -1);

  return {
    practice_stage1_finish: formatDate(organizationalEnd),
    practice_stage2_finish: formatDate(mainEnd),
    practice_stage3_start: formatDate(finalStart),
  };
}

// Курс — первая цифра после дефиса в номере группы, например «РИ-330948» → 3.
function courseFromGroup(group: string | undefined): string {
  if (!group) return "";
  const afterDash = group.split("-")[1] ?? "";
  const digit = afterDash.match(/\d/);
  return digit ? digit[0] : "";
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
    const fieldValues = Object.fromEntries(
      (current?.fieldValues ?? []).map((field) => [
        field.field_key,
        field.value,
      ])
    );
    // Оценка ставится куратором в отзыве, но нужна и на титульном листе —
    // если куратор её ещё не выставил, лист всё равно можно сформировать без неё.
    const reviewDocument = application.documents.find(
      (document) => document.type === DocumentType.REVIEW
    );
    const reviewGrade = reviewDocument?.fieldValues.find(
      (field) => field.field_key === "review_grade"
    )?.value;
    const values = {
      ...fieldValues,
      student_fio_genitive: toGenitive(
        fieldValues.student_fio || application.user.full_name
      ),
      student_fio_initials: toInitials(
        fieldValues.student_fio || application.user.full_name
      ),
      review_grade: reviewGrade ?? "",
      course: courseFromGroup(fieldValues.group),
      ...(fieldValues.institute_abbr && {
        institute_abbr: fieldValues.institute_abbr.toUpperCase(),
      }),
      ...(fieldValues.practice_type && {
        practice_type_short: fieldValues.practice_type.split(",")[0].trim(),
      }),
      practice_start: formatDate(
        application.track.cohort.practice_start
      ),
      practice_end: formatDate(
        application.track.cohort.practice_end
      ),
      practice_start_day: formatDateParts(
        application.track.cohort.practice_start
      ).day,
      practice_start_month: formatDateParts(
        application.track.cohort.practice_start
      ).month,
      practice_start_year_short: formatDateParts(
        application.track.cohort.practice_start
      ).year_short,
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
