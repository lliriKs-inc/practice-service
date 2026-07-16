import { describe, expect, it } from "vitest";
// The production harness is intentionally dependency-free JavaScript for direct Node execution.
// @ts-expect-error No separate declaration file is needed for this test-only import.
import { createLoadRequests } from "../../scripts/load/scenarios.mjs";

describe("load smoke scenarios", () => {
  it("defaults to operational probes", () => {
    expect(createLoadRequests({})).toEqual([
      { name: "health", path: "/health" },
      { name: "readiness", path: "/ready" },
    ]);
  });

  it("builds authenticated cohort-scoped admin reads", () => {
    const requests = createLoadRequests({
      LOAD_SCENARIO: "admin-reads",
      LOAD_COHORT_ID: "cohort/one",
      LOAD_ADMIN_BEARER_TOKEN: "admin-token",
    });

    expect(requests).toHaveLength(4);
    expect(requests[0]).toEqual({
      name: "cohort progress",
      path: "/api/v1/cohorts/cohort%2Fone/progress",
      token: "admin-token",
    });
    expect(requests.every((request) => request.token === "admin-token")).toBe(true);
  });

  it("builds student reads with an optional week", () => {
    const requests = createLoadRequests({
      LOAD_SCENARIO: "student-reads",
      LOAD_APPLICATION_ID: "application-1",
      LOAD_STUDENT_BEARER_TOKEN: "student-token",
      LOAD_WEEK_START: "2026-07-13",
    });

    expect(requests[0].path).toBe(
      "/api/v1/me/applications/application-1/tasks?weekStart=2026-07-13",
    );
    expect(requests.map((request) => request.name)).toContain("document readiness");
  });

  it("rejects missing credentials and unknown scenarios", () => {
    expect(() =>
      createLoadRequests({ LOAD_SCENARIO: "admin-reads", LOAD_COHORT_ID: "cohort-1" }),
    ).toThrow("LOAD_ADMIN_BEARER_TOKEN");
    expect(() => createLoadRequests({ LOAD_SCENARIO: "writes" })).toThrow(
      "Unknown LOAD_SCENARIO",
    );
  });

  it("keeps custom paths backward compatible", () => {
    expect(
      createLoadRequests({
        LOAD_PATHS: " /one, /two ",
        LOAD_BEARER_TOKEN: "token",
      }),
    ).toEqual([
      { name: "/one", path: "/one", token: "token" },
      { name: "/two", path: "/two", token: "token" },
    ]);
  });
});
