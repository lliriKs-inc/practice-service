import type { Response } from "express";
import { config } from "../../shared/config";

export const AUTH_SESSION_COOKIE = "practice_session";

export function setAuthSessionCookie(res: Response, token: string) {
  res.cookie(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.environment === "production",
    path: "/",
  });
}

export function clearAuthSessionCookie(res: Response) {
  res.clearCookie(AUTH_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.environment === "production",
    path: "/",
  });
}
