import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing database...\n");

  const landmarks = await prisma.landmarkArticle.deleteMany();
  console.log(`Deleted ${landmarks.count} landmark articles`);

  const docs = await prisma.document.deleteMany();
  console.log(`Deleted ${docs.count} documents`);

  console.log("\nDatabase cleared. Ready for fresh start with Google Sheets import.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
