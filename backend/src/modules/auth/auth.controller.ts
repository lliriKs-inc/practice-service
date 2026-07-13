import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema } from "./dto/register.dto";
import { loginSchema } from "./dto/login.dto";

export class AuthController {
  static async register(req: Request, res: Response) {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Validation failed", errors: result.error.issues });
    }

    try {
      const { email, password, full_name } = result.data;
      const user = await AuthService.register(email, password, full_name);
      res.status(201).json(user);
    } catch (e: any) {
      if (e.message.toLowerCase().includes("exists")) {
        return res.status(409).json({ message: "User already exists" });
      }
      res.status(400).json({ message: e.message });
    }
  }

  static async login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Validation failed", errors: result.error.issues });
    }

    try {
      const { email, password } = result.data;
      const resultData = await AuthService.login(email, password);
      res.json(resultData);
    } catch (e: any) {
      res.status(401).json({ message: "Invalid credentials" });
    }
  }

  static async me(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await AuthService.getMe(userId);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
}
