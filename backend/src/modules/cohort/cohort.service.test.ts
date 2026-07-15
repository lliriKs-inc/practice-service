import { afterEach, describe, expect, it, vi } from "vitest";
import { CohortStatus } from "@prisma/client";
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
    vi.spyOn(prisma.application, "count").mockResolvedValue(0);
    vi.spyOn(prisma.testTaskSubmission, "count").mockResolvedValue(0);
    const remove = vi.spyOn(prisma.cohort, "delete").mockResolvedValue({} as any);

    await expect(
      service.deleteCohort("cohort-1", "admin-1", "request-1"),
    ).resolves.toEqual({ deleted: true });

    expect(remove).toHaveBeenCalledWith({ where: { id: "cohort-1" } });
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

  it("rejects deleting a cohort that has applications or submissions", async () => {
    const service = new CohortService();
    vi.spyOn(service, "getCohort").mockResolvedValue({
      id: "cohort-1",
      status: CohortStatus.DRAFT,
      tracks: [],
    } as any);
    vi.spyOn(prisma.application, "count").mockResolvedValue(1);
    vi.spyOn(prisma.testTaskSubmission, "count").mockResolvedValue(0);

    await expect(service.deleteCohort("cohort-1")).rejects.toMatchObject({
      code: "COHORT_HAS_APPLICATIONS",
    });
  });
});
