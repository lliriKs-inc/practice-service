import bcrypt from "bcrypt";
import { prisma } from "../../shared/prisma";
import { generateToken } from "../../shared/jwt";

export class AuthService {
  static async register(email: string, password: string, full_name: string) {
    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      throw new Error("User already exists");
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hash,
        full_name,
      },
    });

    return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        active_cohort_id: user.active_cohort_id,
        created_at: user.created_at,
    };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const token = generateToken({
      id: user.id,
      role: user.role,
    });

    return { token };
  }
  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        active_cohort_id: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}
