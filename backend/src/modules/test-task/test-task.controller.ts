import { Request, Response, NextFunction } from 'express';
import { TestTaskService } from './test-task.service';
import { CreateTestTaskSchema } from './dto/create-test-task.dto';

const testTaskService = new TestTaskService();

export class TestTaskController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const cohortId = req.cohortId;
      if (!cohortId) {
        return res.status(400).json({ error: 'Идентификатор когорты не найден в контексте запроса' });
      }

      const validatedBody = CreateTestTaskSchema.parse(req.body);
      const task = await testTaskService.createTestTask(cohortId, validatedBody);
      return res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const cohortId = req.cohortId;
      if (!cohortId) {
        return res.status(400).json({ error: 'Идентификатор когорты не найден' });
      }

      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        return res.status(401).json({ error: 'Пользователь не авторизован' });
      }

      const tasks = await testTaskService.getTasksForContext(cohortId, userId, userRole);
      return res.json(tasks);
    } catch (error: any) {
      if (error.message === 'ACCESS_DENIED_NO_APPLICATION') {
        return res.status(403).json({ 
          error: 'Тестовое задание станет доступно только после отправки анкеты' 
        });
      }
      next(error);
    }
  }
}