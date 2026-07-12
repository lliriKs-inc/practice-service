import { describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { requireRole } from "./role.middleware";

describe("requireRole", () => {
  it("rejects unauthenticated requests", () => {
    const next = vi.fn();
    requireRole(UserRole.ADMIN)({} as any, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_REQUIRED", statusCode: 401 })
    );
  });

  it("rejects a user with an insufficient role", () => {
    const next = vi.fn();
    requireRole(UserRole.ADMIN)(
      { user: { id: "student-1", role: UserRole.STUDENT } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INSUFFICIENT_PERMISSIONS",
        statusCode: 403,
      })
    );
  });

  it("allows an authorized role", () => {
    const next = vi.fn();
    requireRole(UserRole.ADMIN)(
      { user: { id: "admin-1", role: UserRole.ADMIN } } as any,
      {} as any,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });
});
