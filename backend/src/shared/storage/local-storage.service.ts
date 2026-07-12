import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
} from "node:fs";
import {
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import {
  InvalidStorageKeyError,
  StorageError,
  StorageFileNotFoundError,
} from "./storage.errors";
import type { StorageService } from "./storage.service";
import {
  STORAGE_CATEGORIES,
} from "./storage.types";
import type {
  OpenedFile,
  ReplaceFileInput,
  SaveFileInput,
  StorageCategory,
  StorageKeyParts,
  StoredFile,
} from "./storage.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STORAGE_FILE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?$/i;

export interface LocalStorageServiceOptions {
  rootDirectory?: string;
  generateId?: () => string;
  now?: () => Date;
}

function isNodeError(
  error: unknown
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export class LocalStorageService implements StorageService {
  private readonly rootDirectory: string;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: LocalStorageServiceOptions = {}) {
    this.rootDirectory = path.resolve(
      options.rootDirectory ?? config.storage.uploadDir
    );

    this.generateId = options.generateId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const fileName = this.createFileName(
      this.generateId(),
      input.originalName
    );

    const key = `${input.category}/${fileName}`;
    const destinationPath = this.resolveKey(key);

    const categoryDirectory = path.dirname(destinationPath);
    const temporaryPath = path.join(
      categoryDirectory,
      `.${fileName}.${randomUUID()}.tmp`
    );

    const checksum = createHash("sha256")
      .update(input.content)
      .digest("hex");

    try {
      await mkdir(categoryDirectory, {
        recursive: true,
      });

      await writeFile(temporaryPath, input.content, {
        flag: "wx",
      });

      await rename(temporaryPath, destinationPath);

      return {
        key,
        category: input.category,
        originalName: input.originalName,
        contentType: input.contentType,
        size: input.content.length,
        checksum,
        storedAt: this.now(),
      };
    } catch (error) {
      await rm(temporaryPath, {
        force: true,
      }).catch(() => undefined);

      throw new StorageError(
        "Не удалось сохранить файл",
        "STORAGE_WRITE_FAILED",
        {
          category: input.category,
        }
      );
    }
  }

  async open(key: string): Promise<OpenedFile> {
    const filePath = this.resolveKey(key);

    try {
      const fileStats = await stat(filePath);

      if (!fileStats.isFile()) {
        throw new StorageFileNotFoundError(key);
      }

      return {
        key,
        stream: createReadStream(filePath),
        size: fileStats.size,
      };
    } catch (error) {
      if (error instanceof StorageFileNotFoundError) {
        throw error;
      }

      if (isNodeError(error) && error.code === "ENOENT") {
        throw new StorageFileNotFoundError(key);
      }

      throw new StorageError(
        "Не удалось открыть файл",
        "STORAGE_READ_FAILED"
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveKey(key);

    try {
      const fileStats = await stat(filePath);
      return fileStats.isFile();
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return false;
      }

      throw new StorageError(
        "Не удалось проверить существование файла",
        "STORAGE_STAT_FAILED"
      );
    }
  }

  async remove(key: string): Promise<void> {
    const filePath = this.resolveKey(key);

    try {
      await rm(filePath, {
        force: true,
      });
    } catch {
      throw new StorageError(
        "Не удалось удалить файл",
        "STORAGE_DELETE_FAILED"
      );
    }
  }

  async replace(
    input: ReplaceFileInput
  ): Promise<StoredFile> {
    const storedFile = await this.save(input.file);

    if (!input.previousKey) {
      return storedFile;
    }

    try {
      await this.remove(input.previousKey);
      return storedFile;
    } catch (error) {
      await this.remove(storedFile.key).catch(
        () => undefined
      );

      throw error;
    }
  }

  parseKey(key: string): StorageKeyParts {
    if (
      !key ||
      key.includes("\\") ||
      key.startsWith("/") ||
      key.endsWith("/")
    ) {
      throw new InvalidStorageKeyError();
    }

    const parts = key.split("/");

    if (parts.length !== 2) {
      throw new InvalidStorageKeyError();
    }

    const [category, fileName] = parts;

    if (
      !this.isStorageCategory(category) ||
      !STORAGE_FILE_NAME_PATTERN.test(fileName)
    ) {
      throw new InvalidStorageKeyError();
    }

    return {
      category,
      fileName,
    };
  }

  private resolveKey(key: string): string {
    const { category, fileName } = this.parseKey(key);

    const resolvedPath = path.resolve(
      this.rootDirectory,
      category,
      fileName
    );

    const expectedPrefix = `${this.rootDirectory}${path.sep}`;

    if (!resolvedPath.startsWith(expectedPrefix)) {
      throw new InvalidStorageKeyError();
    }

    return resolvedPath;
  }

  private createFileName(
    id: string,
    originalName: string
  ): string {
    if (!UUID_PATTERN.test(id)) {
      throw new StorageError(
        "Генератор вернул некорректный идентификатор",
        "STORAGE_INVALID_GENERATED_ID"
      );
    }

    const extension = path
      .extname(originalName)
      .toLowerCase();

    const safeExtension =
      /^\.[a-z0-9]{1,10}$/.test(extension)
        ? extension
        : "";

    return `${id}${safeExtension}`;
  }

  private isStorageCategory(
    value: string
  ): value is StorageCategory {
    return (
      STORAGE_CATEGORIES as readonly string[]
    ).includes(value);
  }
}