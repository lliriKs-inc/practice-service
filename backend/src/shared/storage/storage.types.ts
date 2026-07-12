import { Readable } from "node:stream";

export const STORAGE_CATEGORIES = Object.freeze([
  "reports",
  "test-tasks",
  "test-task-submissions",
  "generated-documents",
] as const);

export type StorageCategory =
  (typeof STORAGE_CATEGORIES)[number];

export interface SaveFileInput {
  category: StorageCategory;
  content: Buffer;
  originalName: string;
  contentType: string;
}

export interface StoredFile {
  key: string;
  category: StorageCategory;
  originalName: string;
  contentType: string;
  size: number;
  checksum: string;
  storedAt: Date;
}

export interface OpenedFile {
  key: string;
  stream: Readable;
  size: number;
}

export interface ReplaceFileInput {
  previousKey: string | null;
  file: SaveFileInput;
}

export interface StorageKeyParts {
  category: StorageCategory;
  fileName: string;
}