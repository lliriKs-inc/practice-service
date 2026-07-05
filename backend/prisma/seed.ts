import bcrypt from "bcrypt";
import { prisma } from "../src/shared/prisma";

async function main() {
  const hash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {
      password_hash: hash,
      role: "ADMIN",
    },
    create: {
      email: "admin@test.com",
      password_hash: hash,
      role: "ADMIN",
    },
  });

  console.log("ADMIN CREATED");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
