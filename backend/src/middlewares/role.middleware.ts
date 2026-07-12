import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Пользователь не аутентифицирован",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Недостаточно прав",
      });
    }

    next();
  };
}