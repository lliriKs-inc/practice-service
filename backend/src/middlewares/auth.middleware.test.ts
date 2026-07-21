import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { authenticateJWT } from "./auth.middleware";
import { generateToken } from "../shared/jwt";
import { prisma } from "../shared/prisma";

describe("authenticateJWT", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a missing token", async () => {
    const next = vi.fn();
    await authenticateJWT({ headers: {} } as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_MISSING", statusCode: 401 })
    );
  });

  it("rejects an invalid bearer format", async () => {
    const next = vi.fn();
    await authenticateJWT(
      { headers: { authorization: "Basic token" } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_INVALID_FORMAT" })
    );
  });

  it("hydrates req.user from a valid bearer JWT", async () => {
    const token = generateToken({ id: "user-1", role: UserRole.STUDENT });
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const next = vi.fn();

    await authenticateJWT(req, {} as any, next);

    expect(req.user).toEqual({ id: "user-1", role: UserRole.STUDENT });
    expect(next).toHaveBeenCalledWith();
  });

  it("hydrates a cookie session from the current database user", async () => {
    const token = generateToken({ id: "user-1", role: UserRole.STUDENT });
    const req = { headers: { cookie: `practice_session=${token}` } } as any;
    const next = vi.fn();
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
      id: "user-1",
      role: UserRole.ADMIN,
    } as any);

    await authenticateJWT(req, {} as any, next);

    expect(req.user).toEqual({ id: "user-1", role: UserRole.ADMIN });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const token = generateToken({ id: "deleted-user", role: UserRole.STUDENT });
    const req = { headers: { cookie: `practice_session=${token}` } } as any;
    const res = { clearCookie: vi.fn() } as any;
    const next = vi.fn();
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

    await authenticateJWT(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith(
      "practice_session",
      expect.objectContaining({ httpOnly: true, path: "/" })
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_SESSION_INVALID", statusCode: 401 })
    );
  });

  it("rejects a malformed token", async () => {
    const next = vi.fn();
    await authenticateJWT(
      { headers: { authorization: "Bearer invalid-token" } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_TOKEN_INVALID", statusCode: 401 })
    );
  });
});
