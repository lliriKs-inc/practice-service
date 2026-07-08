import { Request, Response, NextFunction } from 'express';
import { TestTaskService } from './test-task.service';
import { CreateTestTaskSchema } from './dto/create-test-task.dto';
import { UpdateTestTaskSchema } from './dto/update-test-task.dto';

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

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора задания' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const validatedBody = UpdateTestTaskSchema.parse(req.body);
      const updatedTask = await testTaskService.updateTestTask(id, cohortId, validatedBody);

      if (!updatedTask) {
        return res.status(404).json({ error: 'Задание не найдено или у вас нет прав на его изменение' });
      }

      return res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора задания' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const publishedTask = await testTaskService.publishTestTask(id, cohortId);

      if (!publishedTask) {
        return res.status(404).json({ error: 'Задание не найдено или у вас нет прав на его изменение' });
      }

      return res.json(publishedTask);
    } catch (error: any) {
      if (error.message === 'ALREADY_PUBLISHED') {
        return res.status(400).json({ error: 'Тестовое задание уже опубликовано' });
      }
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора задания' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const deletedTask = await testTaskService.deleteTestTask(id, cohortId);

      if (!deletedTask) {
        return res.status(404).json({ error: 'Задание не найдено или у вас нет прав на его удаление' });
      }

      return res.status(200).json({ message: 'Тестовое задание успешно удалено' });
    } catch (error) {
      next(error);
    }
  }
}