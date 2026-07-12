import { describe, expect, it, vi } from "vitest";
import { cohortContextMiddleware } from "./cohortContext.middleware";

function request(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    params: {},
    ...overrides,
  } as any;
}

describe("cohortContextMiddleware", () => {
  it("uses an explicit header and never reads active_cohort_id", () => {
    const req = request({
      headers: { "x-cohort-id": "cohort-from-header" },
      user: { id: "user-1", role: "STUDENT" },
    });
    const next = vi.fn();

    cohortContextMiddleware(req, {} as any, next);

    expect(req.cohortId).toBe("cohort-from-header");
    expect(next).toHaveBeenCalledWith();
  });

  it("prefers an explicit route cohort over the header", () => {
    const req = request({
      params: { cohortId: "cohort-from-route" },
      headers: { "x-cohort-id": "cohort-from-header" },
      user: { id: "user-1", role: "STUDENT" },
    });
    const next = vi.fn();

    cohortContextMiddleware(req, {} as any, next);

    expect(req.cohortId).toBe("cohort-from-route");
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an explicit cohort context for an anonymous request", () => {
    const req = request({ headers: { "x-cohort-id": "cohort-1" } });
    const next = vi.fn();

    cohortContextMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: "AUTH_REQUIRED",
      })
    );
  });

  it("leaves context empty when no explicit context is supplied", () => {
    const req = request({
      user: { id: "user-1", role: "STUDENT" },
    });
    const next = vi.fn();

    cohortContextMiddleware(req, {} as any, next);

    expect(req.cohortId).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });
});
