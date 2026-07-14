import { describe, expect, it } from "vitest";
import { adminApplicationsQuerySchema } from "./admin-applications-query.dto";
import { adminDocumentsQuerySchema } from "./admin-documents-query.dto";

describe("admin query DTOs", () => {
  it("parses supported application filters", () => {
    expect(
      adminApplicationsQuerySchema.parse({
        status: "APPROVED",
        trackId: " track-1 ",
        search: " Student ",
      })
    ).toEqual({
      status: "APPROVED",
      trackId: "track-1",
      search: "Student",
    });
  });

  it("rejects unsupported application filters", () => {
    expect(
      adminApplicationsQuerySchema.safeParse({
        status: "ARCHIVED",
      }).success
    ).toBe(false);
    expect(
      adminApplicationsQuerySchema.safeParse({
        search: "   ",
      }).success
    ).toBe(false);
  });

  it("parses document, report and readiness filters", () => {
    expect(
      adminDocumentsQuerySchema.parse({
        reportStatus: "MISSING",
        documentType: "NOTICE",
        readiness: "INCOMPLETE",
        studentId: "student-1",
      })
    ).toEqual({
      reportStatus: "MISSING",
      documentType: "NOTICE",
      readiness: "INCOMPLETE",
      studentId: "student-1",
    });
  });
});
