import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { requireRole } from '../../middlewares/role.middleware';

const router = Router();
const controller = new ApplicationController();

// Подать заявку (Доступно студентам)
router.post(
  '/applications',
  requireRole('STUDENT'),
  controller.create
);

// Получить свою заявку (Доступно студентам)
router.get(
  '/applications/my',
  requireRole('STUDENT'),
  controller.getMy
);

// Просмотр конкретной заявки по ID (Доступно админам)
router.get(
  '/applications/:id',
  requireRole('ADMIN'),
  controller.getById
);

export default router;