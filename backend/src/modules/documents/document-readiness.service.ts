import {
  ApplicationStatus,
  DocumentType,
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

    const valuesByType = new Map(
      application.documents.map((document) => [
        document.type,
        new Map(
          document.fieldValues.map((field) => [
            field.field_key,
            field.value,
          ])
        ),
      ])
    );

    const readiness = Object.values(DocumentType).map(
      (type) => {
        const config = getDocumentConfig(type);
        const values =
          valuesByType.get(type) ?? new Map<string, string>();

        const missingFields = config.fields
          .filter((field) => field.required)
          .filter((field) =>
            isEmpty(values.get(field.key))
          )
          .map((field) => field.key);

        if (
          config.requiresApprovedReport &&
          application.report?.status !== "APPROVED"
        ) {
          missingFields.push("report.status:APPROVED");
        }

        const uniqueMissingFields = [
          ...new Set(missingFields),
        ];

        return {
          type,
          ready: uniqueMissingFields.length === 0,
          missingFields: uniqueMissingFields,
          generated: Boolean(
            application.documents.find(
              (document) =>
                document.type === type &&
                document.generated_file_url
            )
          ),
          generatedAt:
            application.documents.find(
              (document) => document.type === type
            )?.generated_at ?? null,
        };
      }
    );

    return {
      applicationId: application.id,
      report: application.report
        ? {
            status: application.report.status,
            reviewedAt: application.report.reviewed_at,
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
