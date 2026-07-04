import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateToken } from "../../shared/jwt";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

export class AuthService {
  static async register(email: string, password: string) {
    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      throw new Error("User already exists");
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hash,
      },
    });

    return {
        id: user.id,
        email: user.email,
        role: user.role,
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
}