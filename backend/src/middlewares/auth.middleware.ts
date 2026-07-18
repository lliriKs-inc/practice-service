import { Request, Response, NextFunction } from "express";
import { AppError } from "./error.middleware";
import { verifyToken } from "../shared/jwt";
import { AUTH_SESSION_COOKIE } from "../modules/auth/auth-session.cookie";

function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const prefix = name + "=";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const cookieToken = cookieValue(req.headers.cookie, AUTH_SESSION_COOKIE);
  const authorization = req.headers.authorization;

  if (!cookieToken && !authorization) {
    return next(
      new AppError(
        "Токен авторизации не предоставлен",
        401,
        "AUTH_TOKEN_MISSING"
      )
    );
  }

  let token = cookieToken;

  if (!token && authorization) {
    const [scheme, bearerToken, extraPart] = authorization.trim().split(/\s+/);
    if (scheme === "Bearer" && bearerToken && !extraPart) token = bearerToken;
  }

  if (!token) {
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
