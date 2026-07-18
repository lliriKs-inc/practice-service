import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticateJWT } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.get("/me", authenticateJWT, AuthController.me);
router.patch(
  "/me/active-application",
  authenticateJWT,
  AuthController.selectActiveApplication
);

export default router;
