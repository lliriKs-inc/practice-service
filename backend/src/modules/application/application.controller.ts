import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApplicationService } from './application.service';
import { CreateApplicationSchema } from './dto/application.dto';

const applicationService = new ApplicationService();

export class ApplicationController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const cohortId = req.cohortId; // Из глобального глобального расширения/контекста

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, message: 'Активная когорта не найдена в текущем контексте' });
      }

      // Валидация входных данных через Zod
      const validatedBody = CreateApplicationSchema.parse(req.body);

      const result = await applicationService.createApplication(userId, cohortId, validatedBody);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const cohortId = req.cohortId;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Пользователь не авторизован' });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, message: 'Активная когорта не найдена' });
      }

      const application = await applicationService.getMyApplication(userId, cohortId);
      if (!application) {
        return res.status(404).json({ success: false, message: 'Заявка в текущей когорте еще не подана' });
      }

      return res.json(application);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cohortId = req.cohortId;

      if (typeof id !== 'string') {
        return res.status(400).json({ success: false, message: 'Некорректный формат идентификатора заявки' });
      }
      
      if (!cohortId) {
        return res.status(400).json({ success: false, message: 'Активная когорта не найдена' });
      }

      const application = await applicationService.getApplicationById(id, cohortId);
      if (!application) {
        return res.status(404).json({ success: false, message: 'Заявка не найдена' });
      }

      return res.json(application);
    } catch (error) {
      next(error);
    }
  }
}