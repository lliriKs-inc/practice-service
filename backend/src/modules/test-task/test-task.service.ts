import { Prisma, UserRole } from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../shared/prisma";
import { mailService, type MailService } from "../../shared/mail";
import type { StorageService, SaveFileInput } from "../../shared/storage";
import {
  LocalStorageService,
} from "../../shared/storage";
import { config } from "../../shared/config";
import { auditLogger, type AuditLogger } from "../../shared/logger";
import type { CreateTestTaskDto } from "./dto/create-test-task.dto";
import type { UpdateTestTaskDto } from "./dto/update-test-task.dto";

const taskInclude = {
  track: { select: { id: true, cohort_id: true, title: true } },
} satisfies Prisma.TestTaskInclude;

const submissionInclude = {
  application: {
    select: {
      id: true,
      user_id: true,
      track_id: true,
      track: { select: { id: true, cohort_id: true, title: true } },
    },
  },
} satisfies Prisma.TestTaskSubmissionInclude;

export interface TestTaskServiceOptions {
  storage?: StorageService;
  mail?: MailService;
  audit?: AuditLogger;
}

export type TestTaskActor = {
  id: string;
  role: UserRole;
};

function notFound(message: string, code: string): AppError {
  return new AppError(message, 404, code);
}

export class TestTaskService {
  private readonly storage: StorageService;
  private readonly mail: MailService;
  private readonly audit: AuditLogger;

  constructor(options: TestTaskServiceOptions = {}) {
    this.storage = options.storage ?? new LocalStorageService({
      rootDirectory: config.storage.uploadDir,
    });
    this.mail = options.mail ?? mailService;
    this.audit = options.audit ?? auditLogger;
  }

  async getForTrack(cohortId: string, trackId: string) {
    await this.assertTrackInCohort(cohortId, trackId);

    const task = await prisma.testTask.findUnique({
      where: { track_id: trackId },
      include: taskInclude,
    });

    if (!task) {
      throw notFound("Test task not found", "TEST_TASK_NOT_FOUND");
    }

    return this.toTaskResponse(task);
  }

  async upsertForTrack(
    cohortId: string,
    trackId: string,
    dto: CreateTestTaskDto | UpdateTestTaskDto,
  ) {
    await this.assertTrackInCohort(cohortId, trackId);

    try {
      const task = await prisma.testTask.upsert({
        where: { track_id: trackId },
        create: {
          track_id: trackId,
          title: dto.title ?? "Тестовое задание",
          description: dto.description ?? null,
        },
        update: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
        },
        include: taskInclude,
      });

      return this.toTaskResponse(task);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new AppError(
          "Test task already exists for this track",
          409,
          "TEST_TASK_ALREADY_EXISTS",
        );
      }
      throw error;
    }
  }

  async uploadTaskFile(
    cohortId: string,
    trackId: string,
    file: SaveFileInput,
  ) {
    await this.assertTrackInCohort(cohortId, trackId);
    const task = await prisma.testTask.findUnique({
      where: { track_id: trackId },
      select: { id: true, file_url: true },
    });

    if (!task) {
      throw notFound("Test task not found", "TEST_TASK_NOT_FOUND");
    }

    const stored = await this.storage.save({
      ...file,
      category: "test-tasks",
    });

    try {
      const updated = await prisma.testTask.update({
        where: { id: task.id },
        data: { file_url: stored.key },
        include: taskInclude,
      });

      if (task.file_url && task.file_url !== stored.key) {
        await this.storage.remove(task.file_url);
      }

      return this.toTaskResponse(updated);
    } catch (error) {
      await this.storage.remove(stored.key).catch(() => undefined);
      throw error;
    }
  }

  async publish(
    cohortId: string,
    trackId: string,
    actorId: string | null = null,
    requestId: string | null = null,
  ) {
    await this.assertTrackInCohort(cohortId, trackId);
    const task = await prisma.testTask.findUnique({
      where: { track_id: trackId },
      select: { id: true, title: true, published_at: true },
    });

    if (!task) {
      throw notFound("Test task not found", "TEST_TASK_NOT_FOUND");
    }
    if (task.published_at) {
      throw new AppError(
        "Test task is already published",
        409,
        "TEST_TASK_ALREADY_PUBLISHED",
      );
    }

    const published = await prisma.testTask.update({
      where: { id: task.id },
      data: { published_at: new Date() },
      include: taskInclude,
    });

    this.audit.record({
      action: "TEST_TASK_PUBLISHED",
      outcome: "success",
      actorId,
      requestId,
      resourceType: "test-task",
      resourceId: published.id,
      metadata: { cohortId, trackId },
    });

    await this.notifyApplicants(trackId, task.title);
    return this.toTaskResponse(published);
  }

  async deleteForTrack(cohortId: string, trackId: string) {
    await this.assertTrackInCohort(cohortId, trackId);
    const task = await prisma.testTask.findUnique({
      where: { track_id: trackId },
      select: { id: true, file_url: true },
    });
    if (!task) {
      throw notFound("Test task not found", "TEST_TASK_NOT_FOUND");
    }

    await prisma.testTask.delete({ where: { id: task.id } });
    if (task.file_url) {
      await this.storage.remove(task.file_url);
    }
    return { deleted: true };
  }

  async getForStudent(userId: string, applicationId: string) {
    const application = await prisma.application.findFirst({
      where: { id: applicationId, user_id: userId },
      select: {
        id: true,
        track_id: true,
        track: {
          select: {
            id: true,
            cohort_id: true,
            testTask: true,
          },
        },
        testTaskSubmission: {
          select: { id: true, submitted_at: true },
        },
      },
    });

    if (!application) {
      throw notFound("Application not found", "APPLICATION_NOT_FOUND");
    }

    const task = application.track.testTask;
    if (!task || !task.published_at) {
      return {
        available: false,
        message:
          "Тестовое задание пока не опубликовано. Оно будет направлено на email позже.",
      };
    }

    return {
      available: true,
      id: task.id,
      track_id: application.track_id,
      title: task.title,
      description: task.description,
      published_at: task.published_at,
      has_file: Boolean(task.file_url),
      download_path: task.file_url
        ? `/files/${task.file_url}`
        : null,
      submission: application.testTaskSubmission
        ? {
            id: application.testTaskSubmission.id,
            submitted_at: application.testTaskSubmission.submitted_at,
          }
        : null,
    };
  }

  async replaceSubmission(
    userId: string,
    applicationId: string,
    file: SaveFileInput,
  ) {
    const application = await prisma.application.findFirst({
      where: { id: applicationId, user_id: userId },
      select: {
        id: true,
        track: { select: { testTask: { select: { published_at: true } } } },
        testTaskSubmission: { select: { id: true, file_url: true } },
      },
    });

    if (!application) {
      throw notFound("Application not found", "APPLICATION_NOT_FOUND");
    }
    if (!application.track.testTask?.published_at) {
      throw new AppError(
        "Test task is not available",
        403,
        "TEST_TASK_NOT_PUBLISHED",
      );
    }

    const stored = await this.storage.save({
      ...file,
      category: "test-task-submissions",
    });

    try {
      const submission = await prisma.testTaskSubmission.upsert({
        where: { application_id: applicationId },
        create: { application_id: applicationId, file_url: stored.key },
        update: { file_url: stored.key, submitted_at: new Date() },
      });

      if (application.testTaskSubmission?.file_url) {
        await this.storage.remove(application.testTaskSubmission.file_url);
      }

      return {
        id: submission.id,
        application_id: submission.application_id,
        submitted_at: submission.submitted_at,
        has_file: true,
      };
    } catch (error) {
      await this.storage.remove(stored.key).catch(() => undefined);
      throw error;
    }
  }

  async getSubmissionForStudent(userId: string, applicationId: string) {
    const submission = await prisma.testTaskSubmission.findFirst({
      where: { application_id: applicationId, application: { user_id: userId } },
      include: submissionInclude,
    });

    if (!submission) {
      throw notFound(
        "Test task submission not found",
        "TEST_TASK_SUBMISSION_NOT_FOUND",
      );
    }

    return this.toSubmissionResponse(submission);
  }

  async getSubmissionForAdmin(cohortId: string, applicationId: string) {
    const submission = await prisma.testTaskSubmission.findFirst({
      where: {
        application_id: applicationId,
        application: { track: { cohort_id: cohortId } },
      },
      include: submissionInclude,
    });

    if (!submission) {
      throw notFound(
        "Test task submission not found",
        "TEST_TASK_SUBMISSION_NOT_FOUND",
      );
    }

    return this.toSubmissionResponse(submission);
  }

  async authorizeFile(actor: TestTaskActor, key: string) {
    const task = await prisma.testTask.findFirst({
      where: { file_url: key },
      select: { title: true, track_id: true, published_at: true },
    });

    if (task) {
      const studentHasApplication = actor.role === UserRole.STUDENT
        ? await prisma.application.findFirst({
            where: { user_id: actor.id, track_id: task.track_id },
            select: { id: true },
          })
        : true;

      if (studentHasApplication && (actor.role === UserRole.ADMIN || task.published_at)) {
        return {
          downloadName: `${task.title}.bin`,
          contentType: "application/octet-stream",
        };
      }
      return null;
    }

    const submission = await prisma.testTaskSubmission.findFirst({
      where: { file_url: key },
      include: submissionInclude,
    });

    if (!submission) return null;
    if (
      actor.role !== UserRole.ADMIN &&
      submission.application.user_id !== actor.id
    ) {
      return null;
    }

    return {
      downloadName: "test-task-submission",
      contentType: "application/octet-stream",
    };
  }

  private async assertTrackInCohort(cohortId: string, trackId: string) {
    const track = await prisma.track.findFirst({
      where: { id: trackId, cohort_id: cohortId },
      select: { id: true },
    });
    if (!track) {
      throw notFound("Track not found", "TRACK_NOT_FOUND");
    }
  }

  private async notifyApplicants(trackId: string, title: string) {
    const applications = await prisma.application.findMany({
      where: { track_id: trackId },
      select: { user: { select: { email: true } } },
    });

    const recipients = applications
      .map(({ user }) => user.email)
      .filter((email): email is string => Boolean(email));

    await Promise.allSettled(
      recipients.map((to) =>
        this.mail.send({
          to,
          subject: "Тестовое задание опубликовано",
          text: `Тестовое задание «${title}» опубликовано. Войдите в личный кабинет, чтобы открыть его.`,
          html: `<p>Тестовое задание «${title}» опубликовано.</p><p>Войдите в личный кабинет, чтобы открыть его.</p>`,
        }),
      ),
    );
  }

  private toTaskResponse(task: {
    id: string;
    track_id: string;
    title: string;
    description: string | null;
    file_url: string | null;
    published_at: Date | null;
  }) {
    return {
      id: task.id,
      track_id: task.track_id,
      title: task.title,
      description: task.description,
      published_at: task.published_at,
      available: Boolean(task.published_at),
      has_file: Boolean(task.file_url),
      download_path: task.file_url ? `/files/${task.file_url}` : null,
    };
  }

  private toSubmissionResponse(submission: {
    id: string;
    application_id: string;
    file_url: string;
    submitted_at: Date;
  }) {
    return {
      id: submission.id,
      application_id: submission.application_id,
      submitted_at: submission.submitted_at,
      has_file: true,
      download_path: `/files/${submission.file_url}`,
    };
  }

  private isUniqueViolation(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
