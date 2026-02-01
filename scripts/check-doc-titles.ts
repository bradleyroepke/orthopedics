import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    take: 20,
    select: { title: true, filename: true, author: true, year: true },
  });

  console.log("Sample document titles vs filenames:\n");
  docs.forEach((d) => {
    console.log(`Title: ${d.title}`);
    console.log(`File:  ${d.filename}`);
    console.log(`Meta:  ${d.year || "?"} - ${d.author || "Unknown"}`);
    console.log();
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
