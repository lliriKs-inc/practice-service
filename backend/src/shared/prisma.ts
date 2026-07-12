import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config";

const adapter = new PrismaPg({
  connectionString: config.database.url,
});

export const prisma = new PrismaClient({ adapter });
