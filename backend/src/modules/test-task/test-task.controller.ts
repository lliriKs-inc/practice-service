import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { CreateTestTaskSchema } from "./dto/create-test-task.dto";
import { UpdateTestTaskSchema } from "./dto/update-test-task.dto";
import { TestTaskService } from "./test-task.service";

const service = new TestTaskService();

function param(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value !== "string" || !value) {
    throw new AppError("Invalid route parameter", 400, "VALIDATION_ERROR");
  }
  return value;
}

export class TestTaskController {
  async getForAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json(await service.getForTrack(param(req, "cohortId"), param(req, "trackId")));
    } catch (error) {
      return next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const body = CreateTestTaskSchema.or(UpdateTestTaskSchema).parse(req.body);
      return res.json(await service.upsertForTrack(param(req, "cohortId"), param(req, "trackId"), body));
    } catch (error) {
      return next(error);
    }
  }

  async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.storageUpload) {
        throw new AppError("Test task file is required", 400, "TEST_TASK_FILE_REQUIRED");
      }
      return res.json(await service.uploadTaskFile(param(req, "cohortId"), param(req, "trackId"), req.storageUpload));
    } catch (error) {
      return next(error);
    }
  }

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json(await service.publish(param(req, "cohortId"), param(req, "trackId"), req.user?.id ?? null, req.requestId ?? null));
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json(await service.deleteForTrack(param(req, "cohortId"), param(req, "trackId")));
    } catch (error) {
      return next(error);
    }
  }

  async getForStudent(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      return res.json(await service.getForStudent(req.user.id, param(req, "applicationId")));
    } catch (error) {
      return next(error);
    }
  }

  async replaceSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      if (!req.storageUpload) throw new AppError("Submission file is required", 400, "TEST_TASK_FILE_REQUIRED");
      return res.json(await service.replaceSubmission(req.user.id, param(req, "applicationId"), req.storageUpload));
    } catch (error) {
      return next(error);
    }
  }

  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
      return res.json(await service.getSubmissionForStudent(req.user.id, param(req, "applicationId")));
    } catch (error) {
      return next(error);
    }
  }

  async getSubmissionForAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json(await service.getSubmissionForAdmin(param(req, "cohortId"), param(req, "applicationId")));
    } catch (error) {
      return next(error);
    }
  }
}
