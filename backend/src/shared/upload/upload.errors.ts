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
    actualSize: number | null,
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

export class MissingUploadFileError extends AppError {
  constructor(fieldName: string) {
    super(
      "Файл не был передан",
      400,
      "UPLOAD_FILE_REQUIRED",
      {
        fieldName,
      }
    );

    this.name = "MissingUploadFileError";
  }
}

export class TooManyUploadFilesError extends AppError {
  constructor() {
    super(
      "Разрешена загрузка только одного файла",
      400,
      "UPLOAD_TOO_MANY_FILES"
    );

    this.name = "TooManyUploadFilesError";
  }
}

export class UnexpectedUploadFieldError extends AppError {
  constructor(fieldName: string | undefined) {
    super(
      "Передано неподдерживаемое поле файла",
      400,
      "UPLOAD_UNEXPECTED_FIELD",
      {
        fieldName: fieldName ?? null,
      }
    );

    this.name = "UnexpectedUploadFieldError";
  }
}

export class UploadProcessingError extends AppError {
  constructor(multerCode: string | null = null) {
    super(
      "Не удалось обработать загружаемый файл",
      400,
      "UPLOAD_PROCESSING_FAILED",
      {
        multerCode,
      }
    );

    this.name = "UploadProcessingError";
  }
}
