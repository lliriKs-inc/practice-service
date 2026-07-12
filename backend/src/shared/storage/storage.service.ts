import {
  OpenedFile,
  ReplaceFileInput,
  SaveFileInput,
  StorageKeyParts,
  StoredFile,
} from "./storage.types";

export interface StorageService {
  save(input: SaveFileInput): Promise<StoredFile>;

  open(key: string): Promise<OpenedFile>;

  exists(key: string): Promise<boolean>;

  remove(key: string): Promise<void>;

  replace(input: ReplaceFileInput): Promise<StoredFile>;

  parseKey(key: string): StorageKeyParts;
}