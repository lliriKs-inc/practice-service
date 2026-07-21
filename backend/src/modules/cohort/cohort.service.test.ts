import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationStatus, CohortStatus } from "@prisma/client";
import { CohortService } from "./cohort.service";
import { prisma } from "../../shared/prisma";

describe("CohortService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects reversed practice dates", async () => {
    await expect(new CohortService().createCohort({ title: "Test", practice_start: new Date("2026-08-01"), practice_end: new Date("2026-07-01"), created_by: "admin" })).rejects.toMatchObject({ code: "INVALID_DATE_RANGE" });
  });

  it("requires an application window for ACTIVE cohorts", async () => {
    await expect(new CohortService().createCohort({ title: "Test", status: CohortStatus.ACTIVE, practice_start: new Date("2026-07-01"), practice_end: new Date("2026-08-01"), created_by: "admin" })).rejects.toMatchObject({ code: "INVALID_COHORT_STATUS" });
  });

  it("finds only active cohorts inside the application window", async () => {
    const findFirst = vi.spyOn(prisma.cohort, "findFirst").mockResolvedValue(null);
    await new CohortService().findCurrentPublicCohort();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: CohortStatus.ACTIVE, application_start: expect.any(Object), application_end: expect.any(Object) }) }));
  });

  it("activates a draft only when no other cohort is active", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({ id: "cohort-1", status: CohortStatus.DRAFT, application_start: new Date("2026-06-01"), application_end: new Date("2026-06-30") } as any);
    vi.spyOn(prisma.cohort, "findFirst").mockResolvedValue(null);
    const update = vi.spyOn(prisma.cohort, "update").mockResolvedValue({ id: "cohort-1", status: CohortStatus.ACTIVE } as any);
    await service.activateCohort("cohort-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cohort-1" }, data: { status: CohortStatus.ACTIVE } }));
  });

  it("rejects closing a non-active cohort", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({ id: "cohort-1", status: CohortStatus.DRAFT } as any);
    await expect(service.closeCohort("cohort-1")).rejects.toMatchObject({ code: "INVALID_COHORT_STATUS" });
  });

  it("rejects pending applications when closing an active cohort", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.ACTIVE,
    } as any);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const update = vi.fn().mockResolvedValue({ id: "cohort-1", status: CohortStatus.CLOSED });
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      application: { updateMany },
      cohort: { update },
    }));

    await service.closeCohort("cohort-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: ApplicationStatus.PENDING,
        track: { cohort_id: "cohort-1" },
      },
      data: {
        status: ApplicationStatus.REJECTED,
        rejection_reason: "Когорта закрыта до рассмотрения заявки",
      },
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: CohortStatus.CLOSED },
    }));
  });

  it("does not reopen a closed cohort", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.CLOSED,
      application_start: new Date("2026-06-01"),
      application_end: new Date("2026-06-30"),
    } as any);

    await expect(service.activateCohort("cohort-1")).rejects.toMatchObject({
      code: "INVALID_COHORT_STATUS",
    });
  });

  it("deletes an empty draft cohort and cleans up its task files", async () => {
    const storage = { remove: vi.fn().mockResolvedValue(undefined) };
    const audit = { record: vi.fn() };
    const service = new CohortService({ storage: storage as any, audit });
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.DRAFT,
      tracks: [
        { testTask: { file_url: "test-tasks/task.pdf" } },
        { testTask: null },
      ],
    } as any);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const remove = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      application: { deleteMany },
      cohort: { delete: remove },
    }));

    await expect(
      service.deleteCohort("cohort-1", "admin-1", "request-1"),
    ).resolves.toEqual({ deleted: true });

    expect(remove).toHaveBeenCalledWith({ where: { id: "cohort-1" } });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        status: ApplicationStatus.REJECTED,
        track: { cohort_id: "cohort-1" },
      },
    });
    expect(storage.remove).toHaveBeenCalledWith("test-tasks/task.pdf");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: "COHORT_DELETED",
      actorId: "admin-1",
      requestId: "request-1",
    }));
  });

  it("rejects deleting a cohort that is not a draft", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.ACTIVE,
    } as any);

    await expect(service.deleteCohort("cohort-1")).rejects.toMatchObject({
      code: "COHORT_NOT_DRAFT",
    });
  });

  it("rejects deleting a cohort that has pending or approved applications", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.DRAFT,
      tracks: [],
    } as any);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([
      {
        status: ApplicationStatus.PENDING,
        testTaskSubmission: null,
        report: null,
        documents: [],
      },
    ] as any);

    await expect(service.deleteCohort("cohort-1")).rejects.toMatchObject({
      code: "COHORT_HAS_APPLICATIONS",
    });
  });

  it("deletes a draft with only rejected applications and cleans up their files", async () => {
    const storage = { remove: vi.fn().mockResolvedValue(undefined) };
    const audit = { record: vi.fn() };
    const service = new CohortService({ storage: storage as any, audit });
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.DRAFT,
      tracks: [{ testTask: { file_url: "test-tasks/task.pdf" } }],
    } as any);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([
      {
        status: ApplicationStatus.REJECTED,
        testTaskSubmission: { file_url: "test-task-submissions/solution.zip" },
        report: { file_url: "reports/report.pdf" },
        documents: [
          { generated_file_url: "generated-documents/review.docx" },
          { generated_file_url: null },
        ],
      },
    ] as any);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const deleteCohort = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback({
      application: { deleteMany },
      cohort: { delete: deleteCohort },
    }));

    await expect(service.deleteCohort("cohort-1", "admin-1", "request-1"))
      .resolves.toEqual({ deleted: true });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        status: ApplicationStatus.REJECTED,
        track: { cohort_id: "cohort-1" },
      },
    });
    expect(deleteCohort).toHaveBeenCalledWith({ where: { id: "cohort-1" } });
    expect(storage.remove).toHaveBeenCalledTimes(4);
    expect(storage.remove).toHaveBeenCalledWith("test-tasks/task.pdf");
    expect(storage.remove).toHaveBeenCalledWith("test-task-submissions/solution.zip");
    expect(storage.remove).toHaveBeenCalledWith("reports/report.pdf");
    expect(storage.remove).toHaveBeenCalledWith("generated-documents/review.docx");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        deletedRejectedApplications: 1,
        fileCount: 4,
      }),
    }));
  });
});
