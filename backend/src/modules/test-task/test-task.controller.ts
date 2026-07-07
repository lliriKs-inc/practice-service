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
}