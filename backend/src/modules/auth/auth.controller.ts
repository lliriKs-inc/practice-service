import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }        
      const user = await AuthService.register(email, password);

      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
        }   
      const result = await AuthService.login(email, password);

      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }

  static async me(req: AuthRequest, res: Response) {
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