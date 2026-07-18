import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import { AuthService } from "./auth.service";
import { registerSchema } from "./dto/register.dto";
import { loginSchema } from "./dto/login.dto";
import { activeApplicationSchema } from "./dto/active-application.dto";

export class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        )
      );
    }

    try {
      const { email, password, full_name } = result.data;
      const user = await AuthService.register(email, password, full_name);
      res.status(201).json(user);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("exists")
      ) {
        return next(
          new AppError(
            "User already exists",
            409,
            "USER_ALREADY_EXISTS"
          )
        );
      }
      return next(error);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        )
      );
    }

    try {
      const { email, password } = result.data;
      const resultData = await AuthService.login(email, password);
      res.json(resultData);
    } catch {
      return next(
        new AppError(
          "Invalid credentials",
          401,
          "INVALID_CREDENTIALS"
        )
      );
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return next(
          new AppError(
            "Authentication required",
            401,
            "AUTH_REQUIRED"
          )
        );
      }

      const user = await AuthService.getMe(userId);
      res.json(user);
    } catch (error) {
      return next(
        error instanceof Error &&
          error.message === "User not found"
          ? new AppError(
              "User not found",
              404,
              "USER_NOT_FOUND"
            )
          : error
      );
    }
  }

  static async selectActiveApplication(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const userId = req.user?.id;

    if (!userId) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "AUTH_REQUIRED"
        )
      );
    }

    const result = activeApplicationSchema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        )
      );
    }

    try {
      return res.json(
        await AuthService.selectActiveApplication(
          userId,
          result.data.application_id
        )
      );
    } catch (error) {
      return next(error);
    }
  }
}
