import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { authenticateJWT } from "./auth.middleware";
import { generateToken } from "../shared/jwt";

describe("authenticateJWT", () => {
  it("rejects a missing token", () => {
    const next = vi.fn();
    authenticateJWT({ headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_MISSING", statusCode: 401 })
    );
  });

  it("rejects an invalid bearer format", () => {
    const next = vi.fn();
    authenticateJWT(
      { headers: { authorization: "Basic token" } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_INVALID_FORMAT" })
    );
  });

  it("hydrates req.user from a valid JWT", () => {
    const token = generateToken({ id: "user-1", role: UserRole.STUDENT });
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const next = vi.fn();

    authenticateJWT(req, {} as any, next);

    expect(req.user).toEqual({ id: "user-1", role: UserRole.STUDENT });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a malformed token", () => {
    const next = vi.fn();
    authenticateJWT(
      { headers: { authorization: "Bearer invalid-token" } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_INVALID", statusCode: 401 })
    );
  });
});
