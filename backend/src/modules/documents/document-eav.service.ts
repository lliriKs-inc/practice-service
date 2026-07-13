import {
  ApplicationStatus,
  DocumentType,
  UserRole,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import {
  getDocumentConfig,
} from "./document.config";

function parseDocumentType(
  value: string
): DocumentType {
  if (
    !Object.values(DocumentType).includes(
      value as DocumentType
    )
  ) {
    throw new AppError(
      "Invalid document type",
      400,
      "INVALID_DOCUMENT_TYPE"
    );
  }

  return value as DocumentType;
}

export class DocumentEavService {
  async ensureForApplication(
    applicationId: string
  ) {
    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          status: ApplicationStatus.APPROVED,
        },
        select: {
          id: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    await prisma.$transaction(
      Object.values(DocumentType).map((type) =>
        prisma.document.upsert({
          where: {
            application_id_type: {
              application_id: applicationId,
              type,
            },
          },
          update: {},
          create: {
            application_id: applicationId,
            type,
          },
        })
      )
    );

    return this.getForApplication(
      applicationId
    );
  }

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
        select: {
          id: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    return this.getForApplication(application.id);
  }

  async getForApplication(
    applicationId: string
  ) {
    await this.ensureForApplication(applicationId);

    return prisma.document.findMany({
      where: {
        application_id: applicationId,
      },
      include: {
        fieldValues: {
          orderBy: {
            field_key: "asc",
          },
        },
      },
      orderBy: {
        type: "asc",
      },
    });
  }

  async updateStudentField(
    userId: string,
    applicationId: string,
    typeValue: string,
    fieldKey: string,
    value: string
  ) {
    const type = parseDocumentType(typeValue);

    const application =
      await prisma.application.findFirst({
        where: {
          id: applicationId,
          user_id: userId,
          status: ApplicationStatus.APPROVED,
        },
        select: {
          id: true,
        },
      });

    if (!application) {
      throw new AppError(
        "Application not found",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    const config = getDocumentConfig(type);
    const field = config.fields.find(
      (item) => item.key === fieldKey
    );

    if (!field) {
      throw new AppError(
        "Document field not found",
        404,
        "DOCUMENT_FIELD_NOT_FOUND"
      );
    }

    if (field.owner !== UserRole.STUDENT) {
      throw new AppError(
        "Student cannot edit this field",
        403,
        "DOCUMENT_FIELD_FORBIDDEN"
      );
    }

    const document =
      await prisma.document.upsert({
        where: {
          application_id_type: {
            application_id: applicationId,
            type,
          },
        },
        update: {},
        create: {
          application_id: applicationId,
          type,
        },
      });

    return prisma.documentFieldValue.upsert({
      where: {
        document_id_field_key: {
          document_id: document.id,
          field_key: fieldKey,
        },
      },
      update: {
        value,
        filled_by: UserRole.STUDENT,
      },
      create: {
        document_id: document.id,
        field_key: fieldKey,
        value,
        filled_by: UserRole.STUDENT,
      },
    });
  }
}
