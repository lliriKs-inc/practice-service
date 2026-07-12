export type { StorageService } from "./storage.service";

export {
  LocalStorageService,
} from "./local-storage.service";

export type {
  LocalStorageServiceOptions,
} from "./local-storage.service";

export {
  InvalidStorageKeyError,
  StorageError,
  StorageFileNotFoundError,
} from "./storage.errors";

export {
  STORAGE_CATEGORIES,
} from "./storage.types";

export type {
  OpenedFile,
  ReplaceFileInput,
  SaveFileInput,
  StorageCategory,
  StorageKeyParts,
  StoredFile,
} from "./storage.types";