import { AppError } from "../../middlewares/error.middleware";

export class StorageError extends AppError {
  constructor(
    message: string,
    code: string,
    details: unknown = null
  ) {
    super(message, 500, code, details);
    this.name = "StorageError";
  }
}

export class StorageFileNotFoundError extends AppError {
  constructor(key: string) {
    super(
      "Файл не найден",
      404,
      "STORAGE_FILE_NOT_FOUND",
      { key }
    );

    this.name = "StorageFileNotFoundError";
  }
}

export class InvalidStorageKeyError extends AppError {
  constructor() {
    super(
      "Некорректный ключ файла",
      400,
      "INVALID_STORAGE_KEY"
    );

    this.name = "InvalidStorageKeyError";
  }
}