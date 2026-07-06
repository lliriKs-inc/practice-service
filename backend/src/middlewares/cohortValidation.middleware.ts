import { Request, Response, NextFunction } from 'express';

export function validateCreateCohort(req: Request, res: Response, next: NextFunction) {
  const { name, application_start, application_end, practice_start, practice_end } = req.body;
  const errors: string[] = [];

  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push("Поле 'name' обязательно для заполнения и должно быть строкой.");
  }

  const dateFields = { application_start, application_end, practice_start, practice_end };
  
  for (const [key, value] of Object.entries(dateFields)) {
    if (!value) {
      errors.push(`Поле '${key}' обязательно для заполнения.`);
    } else {
      const parsedDate = Date.parse(value);
      if (isNaN(parsedDate)) {
        errors.push(`Поле '${key}' должно быть валидной датой в формате ISO.`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const appStart = new Date(application_start);
  const appEnd = new Date(application_end);
  const pracStart = new Date(practice_start);
  const pracEnd = new Date(practice_end);

  if (appEnd <= appStart) {
    errors.push("Дата окончания приема заявок (application_end) должна быть позже даты начала (application_start).");
  }

  if (pracEnd <= pracStart) {
    errors.push("Дата окончания практики (practice_end) должна быть позже даты начала практики (practice_start).");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

export function validateUpdateCohort(req: Request, res: Response, next: NextFunction) {
  const { application_start, application_end, practice_start, practice_end } = req.body;
  const errors: string[] = [];

  const incomingDates: Record<string, string> = {};
  if (application_start) incomingDates.application_start = application_start;
  if (application_end) incomingDates.application_end = application_end;
  if (practice_start) incomingDates.practice_start = practice_start;
  if (practice_end) incomingDates.practice_end = practice_end;

  for (const [key, value] of Object.entries(incomingDates)) {
    if (isNaN(Date.parse(value))) {
      errors.push(`Поле '${key}' должно быть валидной датой в формате ISO.`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const appStartStr = application_start || req.body.existing_application_start; 
  const appEndStr = application_end || req.body.existing_application_end;
  const pracStartStr = practice_start || req.body.existing_practice_start;
  const pracEndStr = practice_end || req.body.existing_practice_end;

  if (appStartStr && appEndStr && new Date(appEndStr) <= new Date(appStartStr)) {
    errors.push("Дата окончания приема заявок должна быть позже даты начала.");
  }

  if (pracStartStr && pracEndStr && new Date(pracEndStr) <= new Date(pracStartStr)) {
    errors.push("Дата окончания практики должна быть позже даты начала практики.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}