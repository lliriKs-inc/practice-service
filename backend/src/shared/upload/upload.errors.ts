import { AppError } from "../../middlewares/error.middleware";

export class EmptyUploadError extends AppError {
  constructor() {
    super(
      "Пустой файл не может быть загружен",
      400,
      "UPLOAD_FILE_EMPTY"
    );

    this.name = "EmptyUploadError";
  }
}

export class UploadTooLargeError extends AppError {
  constructor(
    actualSize: number,
    maximumSize: number
  ) {
    super(
      "Размер файла превышает допустимый лимит",
      413,
      "UPLOAD_FILE_TOO_LARGE",
      {
        actualSize,
        maximumSize,
      }
    );

    this.name = "UploadTooLargeError";
  }
}

export class UploadFileTypeNotAllowedError extends AppError {
  constructor(
    contentType: string,
    extension: string
  ) {
    super(
      "Тип файла не поддерживается",
      400,
      "UPLOAD_FILE_TYPE_NOT_ALLOWED",
      {
        contentType,
        extension,
      }
    );

    this.name = "UploadFileTypeNotAllowedError";
  }
}

export class UploadCategoryNotAllowedError extends AppError {
  constructor() {
    super(
      "Загрузка файлов этой категории запрещена",
      400,
      "UPLOAD_CATEGORY_NOT_ALLOWED"
    );

    this.name = "UploadCategoryNotAllowedError";
  }
}