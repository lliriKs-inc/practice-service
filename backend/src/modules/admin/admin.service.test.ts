import {
  ApplicationStatus,
  DocumentType,
  ReportStatus,
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../shared/prisma";
import { AdminService } from "./admin.service";

const student = {
  id: "student-1",
  full_name: "Student One",
  email: "student@example.com",
};

const track = { id: "track-1", title: "Backend" };

describe("AdminService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a cohort-scoped application query with filters", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      id: "cohort-1",
    } as never);
    const findMany = vi
      .spyOn(prisma.application, "findMany")
      .mockResolvedValue([
        {
          id: "application-1",
          status: ApplicationStatus.APPROVED,
          submitted_at: new Date("2026-07-13T10:00:00.000Z"),
          rejection_reason: null,
          user: student,
          track,
          testTaskSubmission: {
            id: "submission-1",
            file_name: "solution.zip",
            file_url: "test-task-submissions/solution.zip",
            submitted_at: new Date("2026-07-13T11:00:00.000Z"),
          },
          report: {
            status: ReportStatus.PENDING,
            uploaded_at: new Date("2026-07-13T12:00:00.000Z"),
            reviewed_at: null,
          },
          dailyTasks: [{ id: "task-1" }],
        },
      ] as never);

    const result = await new AdminService().getApplications(
      "cohort-1",
      {
        status: ApplicationStatus.APPROVED,
        trackId: "track-1",
        search: "student",
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ApplicationStatus.APPROVED,
          track: { cohort_id: "cohort-1", id: "track-1" },
          user: expect.any(Object),
        }),
      })
    );
    expect(result[0]).toMatchObject({
      applicationId: "application-1",
      student,
      track,
      missedDays: 1,
      testTaskSubmission: {
        id: "submission-1",
        fileName: "solution.zip",
        downloadPath: "/files/test-task-submissions/solution.zip",
      },
      report: { status: ReportStatus.PENDING },
    });
  });

  it("does not expose an application from another cohort", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue(
      null
    );

    await expect(
      new AdminService().getApplication(
        "cohort-1",
        "application-from-cohort-2"
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("uses B-04 readiness for all four document types", async () => {
    vi.spyOn(prisma.cohort, "findUnique").mockResolvedValue({
      id: "cohort-1",
    } as never);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([
      {
        id: "application-1",
        user: student,
        track,
        report: null,
        documents: [],
      },
    ] as never);

    const result = await new AdminService().getDocuments(
      "cohort-1",
      { reportStatus: "MISSING", readiness: "INCOMPLETE" }
    );

    expect(result).toHaveLength(1);
    expect(result[0].documents.map((item) => item.type)).toEqual(
      Object.values(DocumentType)
    );
    expect(
      result[0].documents.every((item) => !item.ready)
    ).toBe(true);
  });

  it("returns document field values only for an approved scoped application", async () => {
    const findFirst = vi
      .spyOn(prisma.application, "findFirst")
      .mockResolvedValue({
        id: "application-1",
        user: student,
        track,
        report: {
          id: "report-1",
          status: ReportStatus.APPROVED,
          uploaded_at: new Date("2026-07-13T12:00:00.000Z"),
          reviewed_at: new Date("2026-07-13T13:00:00.000Z"),
        },
        documents: [
          {
            type: DocumentType.NOTICE,
            generated_file_url: null,
            generated_at: null,
            fieldValues: [
              {
                field_key: "student_fio",
                value: "Student One",
                filled_by: "STUDENT",
              },
            ],
          },
        ],
      } as never);

    const result = await new AdminService().getApplicationDocuments(
      "cohort-1",
      "application-1"
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "application-1",
          status: ApplicationStatus.APPROVED,
          track: { cohort_id: "cohort-1" },
        },
      })
    );
    expect(result.fieldValues).toEqual([
      {
        type: DocumentType.NOTICE,
        values: [
          {
            key: "student_fio",
            value: "Student One",
            filledBy: "STUDENT",
          },
        ],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("file_url");
    expect(JSON.stringify(result)).not.toContain("reports/");
  });

  it("returns a stable overview grouped by target enums", async () => {
    const service = new AdminService();
    vi.spyOn(service, "getApplications").mockResolvedValue([
      { status: ApplicationStatus.PENDING },
      { status: ApplicationStatus.APPROVED },
    ] as never);
    vi.spyOn(service, "getDocuments").mockResolvedValue([
      {
        report: { status: ReportStatus.APPROVED },
        documents: Object.values(DocumentType).map((type) => ({
          type,
          ready: true,
          generated: type === DocumentType.NOTICE,
        })),
      },
    ] as never);
    vi.spyOn(prisma.dailyTask, "count")
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2);

    const result = await service.getOverview("cohort-1");

    expect(result).toMatchObject({
      cohortId: "cohort-1",
      applications: {
        total: 2,
        statuses: { PENDING: 1, APPROVED: 1, REJECTED: 0 },
      },
      documents: {
        approvedApplications: 1,
        reports: { APPROVED: 1, MISSING: 0 },
      },
      progress: { totalTasks: 10, missedTasks: 2 },
    });
  });
});
