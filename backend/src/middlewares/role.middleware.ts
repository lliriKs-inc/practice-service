import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export function requireRole(role: "ADMIN" | "STUDENT") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}