import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ApplicationStatus,
  DocumentType,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { DocumentEavService } from "./document-eav.service";

const service = new DocumentEavService();

describe("DocumentEavService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a non-approved application", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(null);

    await expect(
      service.getForStudent(
        "student-1",
        "application-1"
      )
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("rejects another student's application", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue(null);

    await expect(
      service.updateStudentField(
        "another-student",
        "application-1",
        "INDIVIDUAL_TASK",
        "student_fio",
        "Value"
      )
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("rejects an unknown document field", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      id: "application-1",
    } as any);

    await expect(
      service.updateStudentField(
        "student-1",
        "application-1",
        "INDIVIDUAL_TASK",
        "unknown_field",
        "Value"
      )
    ).rejects.toMatchObject({
      code: "DOCUMENT_FIELD_NOT_FOUND",
    });
  });

  it("rejects student edits to admin fields", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      id: "application-1",
    } as any);

    await expect(
      service.updateStudentField(
        "student-1",
        "application-1",
        "REVIEW",
        "review_grade",
        "Excellent"
      )
    ).rejects.toMatchObject({
      code: "DOCUMENT_FIELD_FORBIDDEN",
    });
  });

  it("upserts a student field", async () => {
    vi.spyOn(
      prisma.application,
      "findFirst"
    ).mockResolvedValue({
      id: "application-1",
    } as any);

    vi.spyOn(prisma.document, "upsert")
      .mockResolvedValue({
        id: "document-1",
      } as any);

    const fieldValue = {
      id: "field-value-1",
      document_id: "document-1",
      field_key: "student_fio",
      value: "Student",
      filled_by: UserRole.STUDENT,
    };

    const upsert = vi
      .spyOn(
        prisma.documentFieldValue,
        "upsert"
      )
      .mockResolvedValue(fieldValue as any);

    const result =
      await service.updateStudentField(
        "student-1",
        "application-1",
        DocumentType.INDIVIDUAL_TASK,
        "student_fio",
        "Student"
      );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        document_id_field_key: {
          document_id: "document-1",
          field_key: "student_fio",
        },
      },
      update: {
        value: "Student",
        filled_by: UserRole.STUDENT,
      },
      create: {
        document_id: "document-1",
        field_key: "student_fio",
        value: "Student",
        filled_by: UserRole.STUDENT,
      },
    });

    expect(result).toEqual(fieldValue);
  });

  it("upserts an admin-owned review field inside the selected cohort", async () => {
    const findFirst = vi
      .spyOn(prisma.application, "findFirst")
      .mockResolvedValue({ id: "application-1" } as any);
    vi.spyOn(prisma.document, "upsert").mockResolvedValue({
      id: "document-1",
    } as any);
    const upsert = vi
      .spyOn(prisma.documentFieldValue, "upsert")
      .mockResolvedValue({
        id: "field-1",
        document_id: "document-1",
        field_key: "review_grade",
        value: "A",
        filled_by: UserRole.ADMIN,
      } as any);

    const result = await service.updateAdminField(
      "cohort-1",
      "application-1",
      DocumentType.REVIEW,
      "review_grade",
      "A"
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "application-1",
        status: ApplicationStatus.APPROVED,
        track: { cohort_id: "cohort-1" },
      },
      select: { id: true },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          value: "A",
          filled_by: UserRole.ADMIN,
        },
      })
    );
    expect(result).toEqual({
      id: "field-1",
      key: "review_grade",
      value: "A",
      filledBy: UserRole.ADMIN,
    });
  });

  it("rejects admin writes to student-owned fields", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({
      id: "application-1",
    } as any);

    await expect(
      service.updateAdminField(
        "cohort-1",
        "application-1",
        DocumentType.NOTICE,
        "student_fio",
        "Changed"
      )
    ).rejects.toMatchObject({
      code: "DOCUMENT_FIELD_FORBIDDEN",
      statusCode: 403,
    });
  });
});
