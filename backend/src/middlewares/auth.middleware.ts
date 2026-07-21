import { Request, Response, NextFunction } from "express";
import { AppError } from "./error.middleware";
import { verifyToken } from "../shared/jwt";
import {
  AUTH_SESSION_COOKIE,
  clearAuthSessionCookie,
} from "../modules/auth/auth-session.cookie";
import { prisma } from "../shared/prisma";

function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const prefix = name + "=";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export async function authenticateJWT(
  req: Request,
  res: Response,
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

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(
      new AppError(
        "Токен недействителен или просрочен",
        401,
        "AUTH_TOKEN_INVALID"
      )
    );
  }

  if (!cookieToken) {
    req.user = {
      id: payload.id,
      role: payload.role,
    };
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true },
    });

    if (!user) {
      clearAuthSessionCookie(res);
      return next(
        new AppError(
          "Сессия ссылается на несуществующего пользователя",
          401,
          "AUTH_SESSION_INVALID"
        )
      );
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
