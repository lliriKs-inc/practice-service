import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import multer from "multer";
import type {
  StorageCategory,
} from "../storage";
import {
  MissingUploadFileError,
  TooManyUploadFilesError,
  UnexpectedUploadFieldError,
  UploadProcessingError,
  UploadTooLargeError,
} from "./upload.errors";
import {
  getUploadPolicy,
  validateUploadCandidate,
} from "./upload-policy";

export interface SingleFileUploadOptions {
  category: StorageCategory;
  fieldName?: string;
}

function mapMulterError(
  error: multer.MulterError,
  maximumSize: number
): Error {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return new UploadTooLargeError(
        null,
        maximumSize
      );

    case "LIMIT_FILE_COUNT":
      return new TooManyUploadFilesError();

    case "LIMIT_UNEXPECTED_FILE":
      return new UnexpectedUploadFieldError(
        error.field
      );

    default:
      return new UploadProcessingError(
        error.code
      );
  }
}

export function createSingleFileUpload(
  options: SingleFileUploadOptions
): RequestHandler {
  const fieldName = options.fieldName ?? "file";
  const policy = getUploadPolicy(options.category);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fileSize: policy.maximumSize,
    },
  }).single(fieldName);

  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(
          mapMulterError(
            error,
            policy.maximumSize
          )
        );
      }

      if (error) {
        return next(
          new UploadProcessingError()
        );
      }

      const file = req.file;

      if (!file) {
        return next(
          new MissingUploadFileError(fieldName)
        );
      }

      try {
        validateUploadCandidate({
          category: options.category,
          originalName: file.originalname,
          contentType: file.mimetype,
          size: file.size,
        });

        req.storageUpload = {
          category: options.category,
          content: file.buffer,
          originalName: file.originalname,
          contentType: file.mimetype,
        };

        return next();
      } catch (validationError) {
        return next(validationError);
      }
    });
  };
}