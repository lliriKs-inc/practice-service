import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { AppError } from "./error.middleware";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError(
          "Пользователь не аутентифицирован",
          401,
          "AUTH_REQUIRED"
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "Недостаточно прав для выполнения операции",
          403,
          "INSUFFICIENT_PERMISSIONS"
        )
      );
    }

    return next();
  };
}
