import { prisma } from '../../shared/prisma'; 
import { CreateTestTaskDto } from './dto/create-test-task.dto';

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
      where: {
        user_id: userId,
        cohort_id: cohortId
      }
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
          content: null, // Скрываем текст, на фронте покажем заглушку "появится позже"
          is_published: false
        };
      }
      return {
        ...task,
        is_published: true
      };
    });
  }
}