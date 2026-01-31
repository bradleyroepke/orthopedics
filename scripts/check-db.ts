import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const landmarkCount = await prisma.landmarkArticle.count();
  const docCount = await prisma.document.count();
  const linkedCount = await prisma.landmarkArticle.count({
    where: { documentId: { not: null } },
  });

  console.log("Current database state:");
  console.log("  Documents:", docCount);
  console.log("  Landmark Articles:", landmarkCount);
  console.log("  Landmarks linked to docs:", linkedCount);

  if (landmarkCount > 0) {
    const samples = await prisma.landmarkArticle.findMany({
      take: 5,
      orderBy: { year: "asc" },
      include: { document: true },
    });
    console.log("\nSample landmarks:");
    samples.forEach((s) =>
      console.log(`  - ${s.year} ${s.author} - ${s.title.slice(0, 60)}`)
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
