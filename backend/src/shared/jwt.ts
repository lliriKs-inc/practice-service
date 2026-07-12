import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { config } from "./config";

export interface AuthTokenPayload extends JwtPayload {
  id: string;
  role: UserRole;
}

export function generateToken(payload: {
  id: string;
  role: UserRole;
}): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: "7d",
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.id !== "string" ||
    !Object.values(UserRole).includes(decoded.role as UserRole)
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  return {
    ...decoded,
    id: decoded.id,
    role: decoded.role as UserRole,
  };
}
