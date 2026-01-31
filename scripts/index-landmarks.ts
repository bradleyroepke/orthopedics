import { PrismaClient } from "@prisma/client";
import { readdir, stat } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

type Subspecialty = string;

// Map folder names to subspecialties
const FOLDER_SUBSPECIALTY_MAP: Record<string, Subspecialty> = {
  "Anatomy and Approaches": "ANATOMY",
  "Basic Science": "BASIC_SCIENCE",
  "Billing and Coding": "BILLING",
  "Foot and Ankle": "FOOT_AND_ANKLE",
  "General Articles": "GENERAL",
  "General Orthopedics": "GENERAL",
  Hand: "HAND",
  "Hip and Knee Reconstruction": "HIP_AND_KNEE",
  "Hip and Knee": "HIP_AND_KNEE",
  Oncology: "ONCOLOGY",
  Pediatrics: "PEDIATRICS",
  "Shoulder and Elbow": "SHOULDER_AND_ELBOW",
  Spine: "SPINE",
  "Sports Medicine": "SPORTS_MEDICINE",
  Trauma: "TRAUMA",
};

// Get subspecialty from the parent folder of the Landmark folder
function getSubspecialtyFromPath(filePath: string): Subspecialty {
  const parts = filePath.split(path.sep);

  for (const part of parts) {
    // Skip the "Landmark Articles" folder itself
    if (part.toLowerCase().includes("landmark")) continue;

    // Check direct match
    if (FOLDER_SUBSPECIALTY_MAP[part]) {
      return FOLDER_SUBSPECIALTY_MAP[part];
    }

    // Try partial match
    for (const [folder, subspecialty] of Object.entries(FOLDER_SUBSPECIALTY_MAP)) {
      if (part.toLowerCase().includes(folder.toLowerCase()) ||
          folder.toLowerCase().includes(part.toLowerCase())) {
        return subspecialty;
      }
    }
  }

  return "GENERAL";
}

// Parse filename to extract metadata
// Expected format: Year_Author_Journal_Title.pdf
function parseFilename(filename: string): {
  author: string | null;
  year: number | null;
  journal: string | null;
  title: string;
} {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = nameWithoutExt.split("_");

  let author: string | null = null;
  let year: number | null = null;
  let journal: string | null = null;
  let title = nameWithoutExt;

  if (parts.length >= 4) {
    // Standard format: Year_Author_Journal_Title
    const yearNum = parseInt(parts[0]);
    if (!isNaN(yearNum) && yearNum >= 1800 && yearNum <= 2100) {
      year = yearNum;
    }

    author = parts[1] !== "Unknown" ? parts[1].replace(/-/g, " ") : null;
    journal = parts[2] !== "Unknown" ? parts[2] : null;
    title = parts.slice(3).join(" ").replace(/-/g, " ");
  } else if (parts.length >= 2) {
    const yearNum = parseInt(parts[0]);
    if (!isNaN(yearNum) && yearNum >= 1800 && yearNum <= 2100) {
      year = yearNum;
      author = parts[1] !== "Unknown" ? parts[1].replace(/-/g, " ") : null;
      title = parts.slice(2).join(" ").replace(/-/g, " ") || nameWithoutExt;
    } else {
      title = nameWithoutExt.replace(/_/g, " ");
    }
  }

  // Clean up title
  title = title
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Split CamelCase
    .replace(/\s+/g, " ")
    .trim();

  return { author, year, journal, title: title || nameWithoutExt };
}

interface ScannedDocument {
  filename: string;
  filePath: string;
  fileSize: number;
  subspecialty: Subspecialty;
  metadata: ReturnType<typeof parseFilename>;
}

// Find all Landmark folders
async function findLandmarkFolders(basePath: string): Promise<string[]> {
  const landmarkFolders: string[] = [];

  async function scan(dirPath: string) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.name.toLowerCase().includes("landmark")) {
            landmarkFolders.push(fullPath);
          } else {
            // Continue scanning subdirectories
            await scan(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${dirPath}:`, error);
    }
  }

  await scan(basePath);
  return landmarkFolders;
}

// Scan a single Landmark folder for PDFs
async function scanLandmarkFolder(
  folderPath: string,
  basePath: string
): Promise<ScannedDocument[]> {
  const results: ScannedDocument[] = [];

  try {
    const entries = await readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const fullPath = path.join(folderPath, entry.name);
        const fileStat = await stat(fullPath);
        const relativePath = path.relative(basePath, fullPath);

        const subspecialty = getSubspecialtyFromPath(relativePath);
        const metadata = parseFilename(entry.name);

        results.push({
          filename: entry.name,
          filePath: relativePath,
          fileSize: fileStat.size,
          subspecialty,
          metadata,
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning ${folderPath}:`, error);
  }

  return results;
}

async function main() {
  const articlesPath =
    process.env.ARTICLES_PATH ||
    "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

  console.log("=== Landmark Articles Indexer ===");
  console.log(`Scanning for Landmark folders in: ${articlesPath}\n`);

  // Find all Landmark folders
  const landmarkFolders = await findLandmarkFolders(articlesPath);
  console.log(`Found ${landmarkFolders.length} Landmark folders:`);
  landmarkFolders.forEach((f) => console.log(`  - ${path.relative(articlesPath, f)}`));

  // Scan all Landmark folders for PDFs
  const allDocuments: ScannedDocument[] = [];
  for (const folder of landmarkFolders) {
    const docs = await scanLandmarkFolder(folder, articlesPath);
    allDocuments.push(...docs);
  }

  console.log(`\nFound ${allDocuments.length} landmark PDFs total\n`);

  if (allDocuments.length === 0) {
    console.log("No PDFs found in Landmark folders.");
    console.log("Add PDF files to the Landmark folders and run this script again.");
    return;
  }

  // Clear existing data
  console.log("Clearing existing data...");
  await prisma.landmarkArticle.deleteMany();
  await prisma.document.deleteMany();
  console.log("  Cleared all documents and landmark articles\n");

  // Insert documents and landmark articles
  console.log("Indexing documents...");
  let inserted = 0;

  for (const doc of allDocuments) {
    // Create document
    const document = await prisma.document.create({
      data: {
        filename: doc.filename,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        title: doc.metadata.title,
        author: doc.metadata.author,
        year: doc.metadata.year,
        journal: doc.metadata.journal,
        subspecialty: doc.subspecialty,
        documentType: "ARTICLE",
      },
    });

    // Create landmark article linked to document
    await prisma.landmarkArticle.create({
      data: {
        year: doc.metadata.year || new Date().getFullYear(),
        author: doc.metadata.author || "Unknown",
        journal: doc.metadata.journal || "Unknown",
        title: doc.metadata.title,
        subspecialty: doc.subspecialty,
        documentId: document.id,
        matchConfidence: 1.0,
        displayOrder: inserted,
      },
    });

    inserted++;
    if (inserted % 10 === 0) {
      console.log(`  Indexed ${inserted}/${allDocuments.length}...`);
    }
  }

  // Print summary
  console.log("\n=== Indexing Complete ===");
  console.log(`Total landmark articles indexed: ${allDocuments.length}`);

  const summary = await prisma.document.groupBy({
    by: ["subspecialty"],
    _count: { subspecialty: true },
    orderBy: { _count: { subspecialty: "desc" } },
  });

  console.log("\nBy subspecialty:");
  for (const item of summary) {
    console.log(`  ${item.subspecialty}: ${item._count.subspecialty}`);
  }

  console.log("\nNext steps:");
  console.log("1. Add PDFs to your Landmark folders");
  console.log("2. Run: npm run index:landmarks");
  console.log("3. View at: http://localhost:3000/landmarks");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
