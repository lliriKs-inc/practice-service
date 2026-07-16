import { DocumentType, UserRole } from "@prisma/client";

export type DocumentFieldConfig = {
  key: string;
  owner: UserRole | "SYSTEM";
  required: boolean;
};

export type DocumentTypeConfig = {
  type: DocumentType;
  fields: DocumentFieldConfig[];
  requiresApprovedReport?: boolean;
};

export const DOCUMENT_CONFIG: Record<
  DocumentType,
  DocumentTypeConfig
> = {
  INDIVIDUAL_TASK: {
    type: DocumentType.INDIVIDUAL_TASK,
    fields: [
      "student_fio",
      "group",
      "direction_code",
      "direction_name",
      "program_name",
      "practice_topic",
      "main_stage_tasks",
    ].map((key) => ({
      key,
      owner: UserRole.STUDENT,
      required: true,
    })),
  },

  TITLE_PAGE: {
    type: DocumentType.TITLE_PAGE,
    requiresApprovedReport: true,
    fields: [
      "student_fio",
      "group",
      "specialty",
      "practice_topic",
    ].map((key) => ({
      key,
      owner: UserRole.STUDENT,
      required: true,
    })),
  },

  REVIEW: {
    type: DocumentType.REVIEW,
    fields: [
      "student_fio",
      "group",
      "review_activities",
      "review_characteristic",
      "review_employed",
      "review_next_practice",
      "review_employment_offer",
      "review_suggestions",
      "review_grade",
    ].map((key) => ({
      key,
      owner: ["student_fio", "group"].includes(key)
        ? UserRole.STUDENT
        : UserRole.ADMIN,
      required: true,
    })),
  },

  NOTICE: {
    type: DocumentType.NOTICE,
    fields: [
      "student_fio",
      "group",
      "practice_topic",
    ].map((key) => ({
      key,
      owner: UserRole.STUDENT,
      required: true,
    })),
  },
};

export function getDocumentConfig(
  type: DocumentType
): DocumentTypeConfig {
  return DOCUMENT_CONFIG[type];
}
