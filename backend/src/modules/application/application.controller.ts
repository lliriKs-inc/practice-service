import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApplicationService } from './application.service';
import { CreateApplicationSchema } from './dto/application.dto';

const applicationService = new ApplicationService();

export class ApplicationController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const cohortId = req.cohortId;

      if (!userId) {
        return res.status(401).json({ success: false, errors: ['Пользователь не авторизован'] });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, errors: ['Активная когорта не найдена в текущем контексте'] });
      }

      const validatedBody = CreateApplicationSchema.parse(req.body);

      const result = await applicationService.createOrUpdateApplication(userId, cohortId, validatedBody);
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error.statusCode === 403) {
        return res.status(403).json({ success: false, errors: [error.message] });
      }
      next(error);
    }
  }

  async getForm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const cohortId = req.cohortId;

      if (!userId) {
        return res.status(401).json({ success: false, errors: ['Пользователь не авторизован'] });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, errors: ['Активная когорта не найдена в текущем контексте'] });
      }

      const formData = await applicationService.getRegistrationForm(userId, cohortId);
      return res.json({ success: true, data: formData });
    } catch (error) {
      next(error);
    }
  }

  async getMy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const cohortId = req.cohortId;

      if (!userId) {
        return res.status(401).json({ success: false, errors: ['Пользователь не авторизован'] });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, errors: ['Активная когорта не найдена в текущем контексте'] });
      }

      const application = await applicationService.getMyApplication(userId, cohortId);
      
      if (!application) {
        return res.status(404).json({ success: false, errors: ['Заявка в текущей когорте еще не подана'] });
      }

      return res.json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cohortId = req.cohortId;

      if (typeof id !== 'string') {
        return res.status(400).json({ success: false, errors: ['Некорректный формат идентификатора заявки'] });
      }

      if (!cohortId) {
        return res.status(400).json({ success: false, errors: ['Активная когорта не найдена в текущем контексте'] });
      }

      const application = await applicationService.getApplicationById(id, cohortId);
      
      if (!application) {
        return res.status(404).json({ success: false, errors: ['Заявка не найдена'] });
      }

      return res.json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }
}