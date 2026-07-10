import { Request, Response, NextFunction } from 'express';
import { SurveyService } from './survey.service';
import { CreateSurveyFieldSchema, UpdateSurveyFieldSchema } from './dto/survey.dto';

interface AuthenticatedRequest extends Request {
  cohortId?: string; 
  user?: any;
}

const surveyService = new SurveyService();

export class SurveyController {
  async createField(req: Request, res: Response, next: NextFunction) {
    try {
      const cohortId = req.cohortId;
      if (!cohortId) {
        return res.status(400).json({ error: 'Идентификатор когорты не найден в контексте запроса' });
      }

      const validatedBody = CreateSurveyFieldSchema.parse(req.body);
      const field = await surveyService.createField(cohortId, validatedBody);
      
      return res.status(201).json(field);
    } catch (error) {
      next(error);
    }
  }

  async getAllFields(req: Request, res: Response, next: NextFunction) {
    try {
      const cohortId = req.cohortId;
      if (!cohortId) {
        return res.status(400).json({ error: 'Идентификатор когорты не найден' });
      }

      const fields = await surveyService.getAllFields(cohortId);
      return res.json(fields);
    } catch (error) {
      next(error);
    }
  }

  async getFieldById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поля' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const field = await surveyService.getFieldById(id, cohortId);
      if (!field) {
        return res.status(404).json({ error: 'Поле анкеты не найдено в текущей когорте' });
      }

      return res.json(field);
    } catch (error) {
      next(error);
    }
  }

  async updateField(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поля' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const validatedBody = UpdateSurveyFieldSchema.parse(req.body);
      const updatedField = await surveyService.updateField(id, cohortId, validatedBody);

      if (!updatedField) {
        return res.status(404).json({ error: 'Поле не найдено или у вас нет прав на его изменение' });
      }

      return res.json(updatedField);
    } catch (error) {
      next(error);
    }
  }

  async deleteField(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: 'Некорректный формат идентификатора поля' });
      }

      const cohortId = req.cohortId;
      if (!cohortId) return res.status(400).json({ error: 'Идентификатор когорты не найден' });

      const deletedField = await surveyService.deleteField(id, cohortId);
      if (!deletedField) {
        return res.status(404).json({ error: 'Поле не найдено или уже удалено' });
      }

      return res.status(200).json({ message: 'Поле анкеты успешно удалено' });
    } catch (error) {
      next(error);
    }
  }

  async getPublicCurrentFields(req: Request, res: Response, next: NextFunction) {
    try {
      const fields = await surveyService.getPublicCurrentFields();

      if (!fields) {
        return res.status(404).json({
          message: "В данный момент нет активных когорт, открытых для регистрации студентов.",
        });
      }

      return res.json(fields);
    } catch (error) {
      next(error);
    }
  }
}