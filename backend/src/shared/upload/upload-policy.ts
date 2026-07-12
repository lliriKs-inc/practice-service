import path from "node:path";
import { config } from "../config";
import type {
  StorageCategory,
} from "../storage";
import {
  EmptyUploadError,
  UploadCategoryNotAllowedError,
  UploadFileTypeNotAllowedError,
  UploadTooLargeError,
} from "./upload.errors";

export const UPLOADABLE_STORAGE_CATEGORIES = Object.freeze([
  "reports",
  "test-tasks",
  "test-task-submissions",
] as const);

export type UploadableStorageCategory =
  (typeof UPLOADABLE_STORAGE_CATEGORIES)[number];

export interface UploadPolicy {
  maximumSize: number;
  allowedContentTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export interface UploadCandidate {
  category: StorageCategory;
  originalName: string;
  contentType: string;
  size: number;
}

const WORD_CONTENT_TYPES = Object.freeze([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ARCHIVE_CONTENT_TYPES = Object.freeze([
  "application/zip",
  "application/x-zip-compressed",
]);

const UPLOAD_POLICIES: Readonly<
  Record<UploadableStorageCategory, UploadPolicy>
> = Object.freeze({
  reports: Object.freeze({
    maximumSize: config.storage.maxFileSizeBytes,
    allowedContentTypes: Object.freeze([
      "application/pdf",
      ...WORD_CONTENT_TYPES,
    ]),
    allowedExtensions: Object.freeze([
      ".pdf",
      ".doc",
      ".docx",
    ]),
  }),

  "test-tasks": Object.freeze({
    maximumSize: config.storage.maxFileSizeBytes,
    allowedContentTypes: Object.freeze([
      "application/pdf",
      ...WORD_CONTENT_TYPES,
      ...ARCHIVE_CONTENT_TYPES,
    ]),
    allowedExtensions: Object.freeze([
      ".pdf",
      ".doc",
      ".docx",
      ".zip",
    ]),
  }),

  "test-task-submissions": Object.freeze({
    maximumSize: config.storage.maxFileSizeBytes,
    allowedContentTypes: Object.freeze([
      "application/pdf",
      ...WORD_CONTENT_TYPES,
      ...ARCHIVE_CONTENT_TYPES,
    ]),
    allowedExtensions: Object.freeze([
      ".pdf",
      ".doc",
      ".docx",
      ".zip",
    ]),
  }),
});

export function isUploadableStorageCategory(
  category: StorageCategory
): category is UploadableStorageCategory {
  return (
    UPLOADABLE_STORAGE_CATEGORIES as readonly string[]
  ).includes(category);
}

export function getUploadPolicy(
  category: StorageCategory
): UploadPolicy {
  if (!isUploadableStorageCategory(category)) {
    throw new UploadCategoryNotAllowedError();
  }

  return UPLOAD_POLICIES[category];
}

export function validateUploadCandidate(
  candidate: UploadCandidate
): void {
  const policy = getUploadPolicy(candidate.category);

  if (candidate.size <= 0) {
    throw new EmptyUploadError();
  }

  if (candidate.size > policy.maximumSize) {
    throw new UploadTooLargeError(
      candidate.size,
      policy.maximumSize
    );
  }

  const normalizedContentType = candidate.contentType
    .split(";")[0]
    .trim()
    .toLowerCase();

  const extension = path
    .extname(candidate.originalName)
    .toLowerCase();

  const contentTypeAllowed =
    policy.allowedContentTypes.includes(
      normalizedContentType
    );

  const extensionAllowed =
    policy.allowedExtensions.includes(extension);

  if (!contentTypeAllowed || !extensionAllowed) {
    throw new UploadFileTypeNotAllowedError(
      normalizedContentType,
      extension
    );
  }
}
