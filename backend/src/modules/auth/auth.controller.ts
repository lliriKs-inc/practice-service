import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const user = await AuthService.register(email, password);

      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
}