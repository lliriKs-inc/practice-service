import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { requireRole } from '../../middlewares/role.middleware';

const router = Router();
const controller = new ApplicationController();

router.get(
  '/applications/form',
  requireRole('STUDENT'),
  controller.getForm
);

router.post(
  '/applications',
  requireRole('STUDENT'),
  controller.create
);

router.get(
  '/applications/my',
  requireRole('STUDENT'),
  controller.getMy
);

router.get(
  '/applications/:id',
  requireRole('ADMIN'),
  controller.getById
);

export default router;