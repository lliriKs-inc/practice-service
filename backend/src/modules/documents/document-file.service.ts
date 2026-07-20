import {
  ApplicationStatus,
  DocumentType,
} from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import {
  StorageFileNotFoundError,
  type StorageService,
} from "../../shared/storage";
import { DOCX_CONTENT_TYPE } from "./generated-document.service";

export type DownloadableDocumentFile = {
  stream: NodeJS.ReadableStream;
  size: number;
  contentType: string;
  downloadName: string;
};

function parseDocumentType(value: string): DocumentType {
  if (!Object.values(DocumentType).includes(value as DocumentType)) {
    throw new AppError(
      "Document file not found",
      404,
      "DOCUMENT_FILE_NOT_FOUND"
    );
  }

  return value as DocumentType;
}

function reportDownloadName(key: string | null | undefined): string {
  const name = key?.split(/[\\/]/).pop()?.trim();
  const encodedName = name?.match(/__name_([A-Za-z0-9_-]+)(\.[a-z0-9]{2,5})$/i)?.[1];
  if (encodedName) {
    try {
      const decoded = Buffer.from(encodedName, "base64url").toString("utf8");
      const extension = name?.match(/(\.[a-z0-9]{2,5})$/i)?.[1] ?? "";
      return `${decoded}${extension}`;
    } catch { /* fallback below */ }
  }
  const originalName = name?.split("__").slice(1).join("__");
  return originalName && /\.[a-z0-9]{2,5}$/i.test(originalName)
    ? originalName
    : name && /\.[a-z0-9]{2,5}$/i.test(name) ? name : "report";
}

function reportContentType(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

export class DocumentFileService {
  constructor(private readonly storage: StorageService) {}

  async openStudentReport(userId: string, applicationId: string) {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        user_id: userId,
        status: ApplicationStatus.APPROVED,
      },
      select: { report: { select: { file_url: true } } },
    });

    const fileKey = application?.report?.file_url;
    const downloadName = reportDownloadName(fileKey);
    return this.open(fileKey, downloadName, reportContentType(downloadName));
  }

  async openAdminReport(cohortId: string, applicationId: string) {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        status: ApplicationStatus.APPROVED,
        track: { cohort_id: cohortId },
      },
      select: { report: { select: { file_url: true } } },
    });

    const fileKey = application?.report?.file_url;
    const downloadName = reportDownloadName(fileKey);
    return this.open(fileKey, downloadName, reportContentType(downloadName));
  }

  async openStudentDocument(
    userId: string,
    applicationId: string,
    typeValue: string
  ) {
    const type = parseDocumentType(typeValue);
    const document = await prisma.document.findFirst({
      where: {
        application_id: applicationId,
        type,
        application: {
          user_id: userId,
          status: ApplicationStatus.APPROVED,
        },
      },
      select: { generated_file_url: true },
    });

    return this.open(
      document?.generated_file_url,
      `${type.toLowerCase()}.docx`,
      DOCX_CONTENT_TYPE
    );
  }

  async openAdminDocument(
    cohortId: string,
    applicationId: string,
    typeValue: string
  ) {
    const type = parseDocumentType(typeValue);
    const document = await prisma.document.findFirst({
      where: {
        application_id: applicationId,
        type,
        application: {
          status: ApplicationStatus.APPROVED,
          track: { cohort_id: cohortId },
        },
      },
      select: { generated_file_url: true },
    });

    return this.open(
      document?.generated_file_url,
      `${type.toLowerCase()}.docx`,
      DOCX_CONTENT_TYPE
    );
  }

  private async open(
    key: string | null | undefined,
    downloadName: string,
    contentType: string
  ): Promise<DownloadableDocumentFile> {
    if (!key) {
      throw new AppError(
        "Document file not found",
        404,
        "DOCUMENT_FILE_NOT_FOUND"
      );
    }

    try {
      const file = await this.storage.open(key);

      return {
        stream: file.stream,
        size: file.size,
        contentType,
        downloadName,
      };
    } catch (error) {
      if (error instanceof StorageFileNotFoundError) {
        throw new AppError(
          "Document file not found",
          404,
          "DOCUMENT_FILE_NOT_FOUND"
        );
      }

      throw error;
    }
  }
}
