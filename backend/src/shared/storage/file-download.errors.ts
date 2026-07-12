import { AppError } from "../../middlewares/error.middleware";

export class FileDownloadNotFoundError extends AppError {
  constructor() {
    super(
      "Файл не найден",
      404,
      "FILE_NOT_FOUND"
    );

    this.name = "FileDownloadNotFoundError";
  }
}

export class FileDownloadStreamError extends AppError {
  constructor() {
    super(
      "Не удалось передать файл",
      500,
      "FILE_DOWNLOAD_FAILED"
    );

    this.name = "FileDownloadStreamError";
  }
}