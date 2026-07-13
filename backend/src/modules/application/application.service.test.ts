import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationStatus, CohortStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { ApplicationService } from "./application.service";

const cohort = {
  id: "cohort-1",
  title: "Practice",
  status: CohortStatus.ACTIVE,
  application_start: new Date(Date.now() - 60_000),
  application_end: new Date(Date.now() + 60_000),
  survey: { questions: [{ id: "question-1", label: "Name", required: true }] },
};
const invitation = { cohort_id: "cohort-1", expires_at: new Date(Date.now() + 60_000), cohort };
const application = { id: "application-1", user_id: "user-1", track_id: "track-1", status: ApplicationStatus.PENDING };

describe("ApplicationService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("submits an application and answers in one transaction", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue(invitation as any);
    vi.spyOn(prisma.track, "findUnique").mockResolvedValue({ id: "track-1", cohort_id: "cohort-1" } as any);
    const tx = {
      application: {
        create: vi.fn().mockResolvedValue(application),
        findUnique: vi.fn().mockResolvedValue(application),
      },
      applicationAnswer: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as any;
    const transaction = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));
    await new ApplicationService().submitByInvitation("user-1", "token", { track_id: "track-1", answers: [{ question_id: "question-1", answer_value: "Alice" }] });
    expect(transaction).toHaveBeenCalled();
    expect(tx.application.create).toHaveBeenCalledWith({ data: { user_id: "user-1", track_id: "track-1", status: ApplicationStatus.PENDING } });
    expect(tx.applicationAnswer.createMany).toHaveBeenCalledWith({ data: [{ application_id: "application-1", question_id: "question-1", answer_value: "Alice" }] });
  });

  it("rejects missing required answers", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue(invitation as any);
    vi.spyOn(prisma.track, "findUnique").mockResolvedValue({ id: "track-1", cohort_id: "cohort-1" } as any);
    await expect(new ApplicationService().submitByInvitation("user-1", "token", { track_id: "track-1", answers: [{ question_id: "question-1", answer_value: " " }] })).rejects.toMatchObject({ code: "REQUIRED_ANSWER_MISSING" });
  });

  it("rejects a track from another cohort", async () => {
    vi.spyOn(prisma.invitation, "findUnique").mockResolvedValue(invitation as any);
    vi.spyOn(prisma.track, "findUnique").mockResolvedValue({ id: "track-2", cohort_id: "other-cohort" } as any);
    await expect(new ApplicationService().submitByInvitation("user-1", "token", { track_id: "track-2", answers: [] })).rejects.toMatchObject({ code: "TRACK_COHORT_MISMATCH" });
  });

  it("lists only a student's applications", async () => {
    const findMany = vi.spyOn(prisma.application, "findMany").mockResolvedValue([]);
    await new ApplicationService().listMine("user-1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: "user-1" } }));
  });

  it("calls B-02 calendar only on transition to approved", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", status: ApplicationStatus.PENDING } as any);
    const update = vi.fn().mockResolvedValue({ ...application, status: ApplicationStatus.APPROVED });
    const tx = { application: { update, findUnique: vi.fn().mockResolvedValue({ ...application, status: ApplicationStatus.APPROVED }) } } as any;
    const transaction = vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));
    const calendar = { ensureForApprovedApplication: vi.fn().mockResolvedValue({ applicationId: "application-1", expectedTaskCount: 5, createdTaskCount: 5 }) };
    await new ApplicationService(calendar as any).updateStatus("cohort-1", "application-1", { status: "APPROVED" });
    expect(transaction).toHaveBeenCalled();
    expect(calendar.ensureForApprovedApplication).toHaveBeenCalledWith("application-1", tx);
  });

  it("does not call calendar when rejecting", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", status: ApplicationStatus.PENDING } as any);
    const tx = { application: { update: vi.fn().mockResolvedValue({ ...application, status: ApplicationStatus.REJECTED }), findUnique: vi.fn().mockResolvedValue({ ...application, status: ApplicationStatus.REJECTED }) } } as any;
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));
    const calendar = { ensureForApprovedApplication: vi.fn() };
    await new ApplicationService(calendar as any).updateStatus("cohort-1", "application-1", { status: "REJECTED", rejection_reason: "Not enough experience" });
    expect(calendar.ensureForApprovedApplication).not.toHaveBeenCalled();
  });

  it("keeps an approval idempotent", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", status: ApplicationStatus.APPROVED } as any);
    const calendar = { ensureForApprovedApplication: vi.fn() };
    const getForCohort = vi.spyOn(ApplicationService.prototype, "getForCohort").mockResolvedValue({ id: "application-1" } as any);
    await new ApplicationService(calendar as any).updateStatus("cohort-1", "application-1", { status: "APPROVED" });
    expect(calendar.ensureForApprovedApplication).not.toHaveBeenCalled();
    expect(getForCohort).toHaveBeenCalledWith("cohort-1", "application-1");
  });

  it("propagates calendar errors so the transaction can roll back", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", status: ApplicationStatus.PENDING } as any);
    const tx = { application: { update: vi.fn().mockResolvedValue(application), findUnique: vi.fn() } } as any;
    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => callback(tx));
    const calendar = { ensureForApprovedApplication: vi.fn().mockRejectedValue(new Error("calendar failed")) };
    await expect(new ApplicationService(calendar as any).updateStatus("cohort-1", "application-1", { status: "APPROVED" })).rejects.toThrow("calendar failed");
  });

  it("rejects an invalid approved-to-rejected transition", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", status: ApplicationStatus.APPROVED } as any);
    await expect(new ApplicationService().updateStatus("cohort-1", "application-1", { status: "REJECTED", rejection_reason: "No" })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });
});
