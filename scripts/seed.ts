import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@ortho-docs.local";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log(`Created admin user: ${user.email}`);
  console.log(`Password: ${password}`);
  console.log("\nIMPORTANT: Change the password in .env for production!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
