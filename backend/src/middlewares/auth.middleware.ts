import { Request, Response, NextFunction } from "express";
import { AppError } from "./error.middleware";
import { verifyToken } from "../shared/jwt";

export function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return next(
      new AppError(
        "Токен авторизации не предоставлен",
        401,
        "AUTH_TOKEN_MISSING"
      )
    );
  }

  const [scheme, token, extraPart] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extraPart) {
    return next(
      new AppError(
        "Некорректный формат токена авторизации",
        401,
        "AUTH_TOKEN_INVALID_FORMAT"
      )
    );
  }

  try {
    const payload = verifyToken(token);

    req.user = {
      id: payload.id,
      role: payload.role,
    };

    return next();
  } catch {
    return next(
      new AppError(
        "Токен недействителен или просрочен",
        401,
        "AUTH_TOKEN_INVALID"
      )
    );
  }
}
