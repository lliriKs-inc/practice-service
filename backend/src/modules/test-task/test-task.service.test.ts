import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import type { MailService } from "../../shared/mail";
import type { StorageService, StoredFile } from "../../shared/storage";
import { TestTaskService } from "./test-task.service";

const stored = (key: string): StoredFile => ({
  key,
  category: key.startsWith("test-tasks/") ? "test-tasks" : "test-task-submissions",
  originalName: "solution.zip",
  contentType: "application/zip",
  size: 10,
  checksum: "checksum",
  storedAt: new Date(),
});

function fakeStorage() {
  const result = {
    saved: [] as string[],
    removed: [] as string[],
    save: vi.fn(async (input: any) => {
      const key = `${input.category}/new-file.zip`;
      result.saved.push(key);
      return stored(key);
    }),
    open: vi.fn(),
    exists: vi.fn(),
    remove: vi.fn(async (key: string) => { result.removed.push(key); }),
    replace: vi.fn(),
    parseKey: vi.fn(),
  };
  return result as unknown as StorageService & { saved: string[]; removed: string[] };
}

function fakeMail() {
  return { send: vi.fn().mockResolvedValue(undefined) } satisfies MailService;
}

describe("TestTaskService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a task for a track and returns a safe read model", async () => {
    vi.spyOn(prisma.track, "findFirst").mockResolvedValue({ id: "track-1" } as any);
    vi.spyOn(prisma.testTask, "upsert").mockResolvedValue({
      id: "task-1", track_id: "track-1", title: "Backend task", description: "Do the work",
      file_url: null, published_at: null, track: { id: "track-1", cohort_id: "cohort-1", title: "Backend" },
    } as any);

    const result = await new TestTaskService().upsertForTrack("cohort-1", "track-1", { title: "Backend task", description: "Do the work" });

    expect(result).toMatchObject({ id: "task-1", track_id: "track-1", available: false, has_file: false });
    expect(prisma.testTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { track_id: "track-1" } }));
  });

  it("does not allow a track from another cohort", async () => {
    vi.spyOn(prisma.track, "findFirst").mockResolvedValue(null);
    await expect(new TestTaskService().getForTrack("cohort-1", "other-track")).rejects.toMatchObject({ code: "TRACK_NOT_FOUND", statusCode: 404 });
  });

  it("publishes once and emails only applicants of the selected track", async () => {
    vi.spyOn(prisma.track, "findFirst").mockResolvedValue({ id: "track-1" } as any);
    vi.spyOn(prisma.testTask, "findUnique").mockResolvedValue({ id: "task-1", title: "Backend task", published_at: null } as any);
    vi.spyOn(prisma.testTask, "update").mockResolvedValue({
      id: "task-1", track_id: "track-1", title: "Backend task", description: null, file_url: null,
      published_at: new Date(), track: { id: "track-1", cohort_id: "cohort-1", title: "Backend" },
    } as any);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([{ user: { email: "one@example.com" } }, { user: { email: "two@example.com" } }] as any);
    const mail = fakeMail();
    const record = vi.fn();

    await new TestTaskService({ mail, audit: { record } }).publish("cohort-1", "track-1", "admin-1", "request-1");

    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: "one@example.com" }));
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: "two@example.com" }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: "TEST_TASK_PUBLISHED",
      actorId: "admin-1",
      requestId: "request-1",
      resourceId: "task-1",
    }));
  });

  it("keeps publication successful when one notification fails", async () => {
    vi.spyOn(prisma.track, "findFirst").mockResolvedValue({ id: "track-1" } as any);
    vi.spyOn(prisma.testTask, "findUnique").mockResolvedValue({ id: "task-1", title: "Task", published_at: null } as any);
    vi.spyOn(prisma.testTask, "update").mockResolvedValue({ id: "task-1", track_id: "track-1", title: "Task", description: null, file_url: null, published_at: new Date(), track: { id: "track-1", cohort_id: "cohort-1", title: "Backend" } } as any);
    vi.spyOn(prisma.application, "findMany").mockResolvedValue([{ user: { email: "fail@example.com" } }, { user: { email: "ok@example.com" } }] as any);
    const mail = fakeMail();
    mail.send.mockRejectedValueOnce(new Error("SMTP failed"));

    await expect(new TestTaskService({ mail }).publish("cohort-1", "track-1")).resolves.toMatchObject({ id: "task-1" });
    expect(mail.send).toHaveBeenCalledTimes(2);
  });

  it("returns an unavailable read model before publication", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", track_id: "track-1", track: { id: "track-1", cohort_id: "cohort-1", testTask: { published_at: null } }, testTaskSubmission: null } as any);
    await expect(new TestTaskService().getForStudent("student-1", "application-1")).resolves.toMatchObject({ available: false });
  });

  it("hides an application belonging to another student", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue(null);
    await expect(new TestTaskService().getForStudent("student-2", "application-1")).rejects.toMatchObject({ code: "APPLICATION_NOT_FOUND" });
  });

  it("upserts a student's submission and removes the previous file", async () => {
    const storage = fakeStorage();
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", track: { testTask: { published_at: new Date() } }, testTaskSubmission: { id: "submission-1", file_url: "test-task-submissions/old.zip" } } as any);
    vi.spyOn(prisma.testTaskSubmission, "upsert").mockResolvedValue({ id: "submission-1", application_id: "application-1", file_url: "test-task-submissions/new-file.zip", submitted_at: new Date() } as any);

    const result = await new TestTaskService({ storage }).replaceSubmission("student-1", "application-1", { category: "test-task-submissions", content: Buffer.from("zip"), originalName: "solution.zip", contentType: "application/zip" });

    expect(result).toMatchObject({ id: "submission-1", application_id: "application-1", has_file: true });
    expect(storage.saved).toEqual(["test-task-submissions/new-file.zip"]);
    expect(storage.removed).toEqual(["test-task-submissions/old.zip"]);
  });

  it("rejects submission before the task is published", async () => {
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1", track: { testTask: { published_at: null } }, testTaskSubmission: null } as any);
    await expect(new TestTaskService().replaceSubmission("student-1", "application-1", {} as any)).rejects.toMatchObject({ code: "TEST_TASK_NOT_PUBLISHED" });
  });

  it("authorizes only the owner of a submission or an admin", async () => {
    vi.spyOn(prisma.testTask, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.testTaskSubmission, "findFirst").mockResolvedValue({ file_url: "test-task-submissions/file.zip", file_name: "solution.zip", file_content_type: "application/zip", application: { id: "application-1", user_id: "student-1", track_id: "track-1", track: { id: "track-1", cohort_id: "cohort-1", title: "Backend" } } } as any);

    const service = new TestTaskService();
    await expect(service.authorizeFile({ id: "student-1", role: UserRole.STUDENT }, "test-task-submissions/file.zip")).resolves.toMatchObject({ downloadName: "solution.zip", contentType: "application/zip" });
    await expect(service.authorizeFile({ id: "student-2", role: UserRole.STUDENT }, "test-task-submissions/file.zip")).resolves.toBeNull();
    await expect(service.authorizeFile({ id: "admin-1", role: UserRole.ADMIN }, "test-task-submissions/file.zip")).resolves.toMatchObject({ downloadName: "solution.zip", contentType: "application/zip" });
  });

  it("authorizes a published task with its uploaded file metadata", async () => {
    vi.spyOn(prisma.testTask, "findFirst").mockResolvedValue({
      file_url: "test-tasks/task.docx",
      file_name: "Задание.docx",
      file_content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      track_id: "track-1",
      published_at: new Date(),
    } as any);
    vi.spyOn(prisma.application, "findFirst").mockResolvedValue({ id: "application-1" } as any);

    await expect(
      new TestTaskService().authorizeFile(
        { id: "student-1", role: UserRole.STUDENT },
        "test-tasks/task.docx",
      ),
    ).resolves.toMatchObject({
      downloadName: "Задание.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });
});
