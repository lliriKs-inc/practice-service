import {
  ApplicationStatus,
  DocumentType,
  ReportStatus,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import {
  DOCUMENT_CONFIG,
  getDocumentConfig,
} from "./document.config";

function isEmpty(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

export type DocumentReadinessInput = {
  type: DocumentType;
  generated_file_url: string | null;
  generated_at: Date | null;
  fieldValues: Array<{
    field_key: string;
    value: string;
  }>;
};

export type ReportReadinessInput = {
  status: ReportStatus;
  reviewed_at: Date | null;
} | null;

export function buildDocumentReadiness(
  documents: DocumentReadinessInput[],
  report: ReportReadinessInput
) {
  const valuesByType = new Map(
    documents.map((document) => [
      document.type,
      new Map(
        document.fieldValues.map((field) => [
          field.field_key,
          field.value,
        ])
      ),
    ])
  );

  return Object.values(DocumentType).map((type) => {
    const config = getDocumentConfig(type);
    const values =
      valuesByType.get(type) ?? new Map<string, string>();

    const missingFields = config.fields
      .filter((field) => field.required)
      .filter((field) => isEmpty(values.get(field.key)))
      .map((field) => field.key);

    if (
      config.requiresApprovedReport &&
      report?.status !== "APPROVED"
    ) {
      missingFields.push("report.status:APPROVED");
    }

    const uniqueMissingFields = [...new Set(missingFields)];
    const document = documents.find(
      (candidate) => candidate.type === type
    );

    return {
      type,
      ready: uniqueMissingFields.length === 0,
      missingFields: uniqueMissingFields,
      generated: Boolean(document?.generated_file_url),
      generatedAt: document?.generated_at ?? null,
    };
  });
}

export class DocumentReadinessService {
  async getForStudent(
    userId: string,
    applicationId: string
  ) {
    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          user_id: userId,
          status: ApplicationStatus.APPROVED,
        },
        include: {
          report: true,
          documents: {
            include: {
              fieldValues: true,
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
    ).map((document) => ({
      ...document,
      downloadPath: document.generated
        ? `/me/applications/${application.id}/documents/${document.type}/file`
        : null,
    }));

    return {
      applicationId: application.id,
      report: application.report
        ? {
            status: application.report.status,
            reviewedAt: application.report.reviewed_at,
            rejectionReason: application.report.rejection_reason,
          }
        : null,
      documents: readiness,
    };
  }

  getConfig() {
    return Object.values(DOCUMENT_CONFIG).map(
      ({ type, fields, requiresApprovedReport }) => ({
        type,
        fields,
        requiresApprovedReport: Boolean(
          requiresApprovedReport
        ),
      })
    );
  }
}
