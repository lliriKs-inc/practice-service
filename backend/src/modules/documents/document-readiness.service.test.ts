import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ApplicationStatus, DocumentType } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { DocumentReadinessService } from "./document-readiness.service";

const service = new DocumentReadinessService();

const application = {
  id: "application-1",
  user_id: "student-1",
  status: ApplicationStatus.APPROVED,
  report: null,
  documents: [],
};

describe("DocumentReadinessService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns readiness for all four document types", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(application as any);

    const result = await service.getForStudent(
      "student-1",
      "application-1"
    );

    expect(result.applicationId).toBe(
      "application-1"
    );

    expect(result.documents).toHaveLength(4);

    expect(
      result.documents.map((document) => document.type)
    ).toEqual([
      DocumentType.INDIVIDUAL_TASK,
      DocumentType.TITLE_PAGE,
      DocumentType.REVIEW,
      DocumentType.NOTICE,
    ]);
  });

  it("returns missing fields for an empty application", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(application as any);

    const result = await service.getForStudent(
      "student-1",
      "application-1"
    );

    const individualTask = result.documents.find(
      (document) =>
        document.type === DocumentType.INDIVIDUAL_TASK
    );

    expect(individualTask?.ready).toBe(false);
    expect(
      individualTask?.missingFields
    ).toContain("student_fio");
  });

  it("blocks title page until report is approved", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      ...application,
      documents: [
        {
          type: DocumentType.TITLE_PAGE,
          generated_file_url: null,
          generated_at: null,
          fieldValues: [
            {
              field_key: "student_fio",
              value: "Student",
            },
            {
              field_key: "group",
              value: "G-101",
            },
            {
              field_key: "specialty",
              value: "Backend",
            },
            {
              field_key: "practice_topic",
              value: "API",
            },
          ],
        },
      ],
      report: {
        status: "PENDING",
        reviewed_at: null,
      },
    } as any);

    const result = await service.getForStudent(
      "student-1",
      "application-1"
    );

    const titlePage = result.documents.find(
      (document) =>
        document.type === DocumentType.TITLE_PAGE
    );

    expect(titlePage?.ready).toBe(false);
    expect(titlePage?.missingFields).toContain(
      "report.status:APPROVED"
    );
  });

  it("allows title page after approved report and fields", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      ...application,
      report: {
        status: "APPROVED",
        reviewed_at: new Date(),
      },
      documents: [
        {
          type: DocumentType.TITLE_PAGE,
          generated_file_url: null,
          generated_at: null,
          fieldValues: [
            {
              field_key: "student_fio",
              value: "Student",
            },
            {
              field_key: "group",
              value: "G-101",
            },
            {
              field_key: "specialty",
              value: "Backend",
            },
            {
              field_key: "practice_topic",
              value: "API",
            },
          ],
        },
      ],
    } as any);

    const result = await service.getForStudent(
      "student-1",
      "application-1"
    );

    const titlePage = result.documents.find(
      (document) =>
        document.type === DocumentType.TITLE_PAGE
    );

    expect(titlePage?.ready).toBe(true);
    expect(titlePage?.missingFields).toEqual([]);
  });

  it("does not expose another student's application", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(null);

    await expect(
      service.getForStudent(
        "another-student",
        "application-1"
      )
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("does not store readiness flags in the database", () => {
    const config = service.getConfig();

    expect(config).toHaveLength(4);

    for (const document of config) {
      expect(document).not.toHaveProperty("ready");
      expect(document).not.toHaveProperty(
        "missingFields"
      );
    }
  });
});
