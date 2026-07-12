import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { AppError } from "../../middlewares/error.middleware";
import {
  FileDownloadNotFoundError,
  FileDownloadStreamError,
} from "./file-download.errors";
import type {
  FileAccessPolicy,
} from "./file-access.policy";
import type {
  StorageService,
} from "./storage.service";
import {
  StorageFileNotFoundError,
} from "./storage.errors";

export interface FileDownloadHandlerOptions {
  storage: StorageService;
  accessPolicy: FileAccessPolicy;
}

function sanitizeDownloadName(
  downloadName: string
): string {
  const sanitized = downloadName
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim();

  return sanitized || "download";
}

export function createFileDownloadHandler(
  options: FileDownloadHandlerOptions
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const actor = req.user;

      if (!actor) {
        return next(
          new AppError(
            "Пользователь не аутентифицирован",
            401,
            "AUTH_REQUIRED"
          )
        );
      }

      const category = req.params.category;
      const fileName = req.params.fileName;

      if (
        typeof category !== "string" ||
        typeof fileName !== "string"
      ) {
        throw new FileDownloadNotFoundError();
      }

      const key = `${category}/${fileName}`;

      try {
        options.storage.parseKey(key);
      } catch {
        throw new FileDownloadNotFoundError();
      }

      const authorization =
        await options.accessPolicy.authorize({
        actor,
        key,
        requestId: req.requestId ?? null,
        });
      if (!authorization) {
        throw new FileDownloadNotFoundError();
      }

      let openedFile;

      try {
        openedFile = await options.storage.open(key);
      } catch (error) {
        if (error instanceof StorageFileNotFoundError) {
            throw new FileDownloadNotFoundError();
        }

        throw error;
      }

      const disposition =
        authorization.disposition ?? "attachment";

      const downloadName = sanitizeDownloadName(
        authorization.downloadName
      );

      res.status(200);
      res.setHeader(
        "Content-Type",
        authorization.contentType
      );
      res.setHeader(
        "Content-Length",
        String(openedFile.size)
      );
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${downloadName}"`
      );
      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );
      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      openedFile.stream.once("error", () => {
        if (!res.headersSent) {
          next(new FileDownloadStreamError());
          return;
        }

        res.destroy();
      });

      openedFile.stream.pipe(res);
      return;
    } catch (error) {
      return next(error);
    }
  };
}