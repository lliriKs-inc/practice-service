import { prisma } from '../../shared/prisma'; 
import { sendMail } from '../../shared/mail';
import { CreateTestTaskDto } from './dto/create-test-task.dto';
import { UpdateTestTaskDto } from './dto/update-test-task.dto';

export class TestTaskService {
  async createTestTask(cohortId: string, dto: CreateTestTaskDto) {
    return prisma.testTask.create({
      data: {
        cohort_id: cohortId,
        content: dto.content,
        published_at: dto.published_at ?? null,
      },
    });
  }

  async getTasksForContext(cohortId: string, userId: string, userRole: string) {
    if (userRole === 'ADMIN') {
      return prisma.testTask.findMany({
        where: { cohort_id: cohortId },
        orderBy: { id: 'asc' }
      });
    }

    const hasApplication = await prisma.application.findFirst({
      where: { user_id: userId, cohort_id: cohortId }
    });

    if (!hasApplication) {
      throw new Error('ACCESS_DENIED_NO_APPLICATION');
    }

    const tasks = await prisma.testTask.findMany({
      where: { cohort_id: cohortId },
      orderBy: { id: 'asc' }
    });

    return tasks.map(task => {
      if (!task.published_at) {
        return {
          id: task.id,
          cohort_id: task.cohort_id,
          published_at: null,
          content: null,
          is_published: false
        };
      }
      return { ...task, is_published: true };
    });
  }

  async updateTestTask(id: string, cohortId: string, dto: UpdateTestTaskDto) {
    const exists = await prisma.testTask.findFirst({
      where: { id, cohort_id: cohortId },
    });

    if (!exists) return null;

    return prisma.testTask.update({
      where: { id },
      data: {
        content: dto.content,
      },
    });
  }

  async publishTestTask(id: string, cohortId: string) {
    const exists = await prisma.testTask.findFirst({
      where: { id, cohort_id: cohortId },
    });

    if (!exists) return null;
    if (exists.published_at !== null) {
      throw new Error('ALREADY_PUBLISHED');
    }

    const publishedTask = await prisma.testTask.update({
      where: { id },
      data: {
        published_at: new Date(),
      },
    });

    await this.notifyApplicantsAboutPublishedTask(cohortId);

    return publishedTask;
  }

  async deleteTestTask(id: string, cohortId: string) {
    const exists = await prisma.testTask.findFirst({
      where: { id, cohort_id: cohortId },
    });

    if (!exists) return null;

    return prisma.testTask.delete({
      where: { id },
    });
  }

  private async notifyApplicantsAboutPublishedTask(cohortId: string) {
    const applications = await prisma.application.findMany({
      where: { cohort_id: cohortId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const recipients = applications
      .map((application) => application.user.email)
      .filter((email): email is string => Boolean(email));

    if (recipients.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      recipients.map((email) =>
        sendMail({
          to: email,
          subject: 'Test task has been published',
          text: 'The test task for your practice application has been published. Please sign in to your account to view it.',
          html: `
            <p>The test task for your practice application has been published.</p>
            <p>Please sign in to your account to view it.</p>
          `,
        })
      )
    );

    const failedCount = results.filter((result) => result.status === 'rejected').length;

    if (failedCount > 0) {
      console.warn(`Failed to send ${failedCount} test task publication email(s)`);
    }
  }
}