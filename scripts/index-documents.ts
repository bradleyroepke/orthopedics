import { PrismaClient } from "@prisma/client";

type Subspecialty = string;
type DocumentType = string;
import { readdir, stat } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

// Map folder names to subspecialties
const FOLDER_SUBSPECIALTY_MAP: Record<string, Subspecialty> = {
  "Foot and Ankle": "FOOT_AND_ANKLE",
  "Foot_and_Ankle": "FOOT_AND_ANKLE",
  "FootAndAnkle": "FOOT_AND_ANKLE",
  Hand: "HAND",
  "Hip and Knee": "HIP_AND_KNEE",
  "Hip_and_Knee": "HIP_AND_KNEE",
  "HipAndKnee": "HIP_AND_KNEE",
  Hip: "HIP_AND_KNEE",
  Knee: "HIP_AND_KNEE",
  "Shoulder and Elbow": "SHOULDER_AND_ELBOW",
  "Shoulder_and_Elbow": "SHOULDER_AND_ELBOW",
  "ShoulderAndElbow": "SHOULDER_AND_ELBOW",
  Shoulder: "SHOULDER_AND_ELBOW",
  Elbow: "SHOULDER_AND_ELBOW",
  Spine: "SPINE",
  "Sports Medicine": "SPORTS_MEDICINE",
  "Sports_Medicine": "SPORTS_MEDICINE",
  SportsMedicine: "SPORTS_MEDICINE",
  Sports: "SPORTS_MEDICINE",
  Trauma: "TRAUMA",
  Oncology: "ONCOLOGY",
  Pediatrics: "PEDIATRICS",
  Pediatric: "PEDIATRICS",
  Textbooks: "TEXTBOOKS",
  Textbook: "TEXTBOOKS",
  Presentations: "PRESENTATIONS",
  Presentation: "PRESENTATIONS",
  Research: "RESEARCH",
  General: "GENERAL",
};

// Map file extensions and paths to document types
function getDocumentType(filename: string, filePath: string): DocumentType {
  const ext = path.extname(filename).toLowerCase();
  const pathLower = filePath.toLowerCase();

  if (ext === ".pptx" || ext === ".ppt") return "PRESENTATION";
  if (pathLower.includes("textbook")) return "TEXTBOOK";
  if (pathLower.includes("presentation")) return "PRESENTATION";
  if (pathLower.includes("research")) return "RESEARCH";
  return "ARTICLE";
}

// Parse filename to extract metadata
// Expected format: Author_Year_Journal_Title.pdf
function parseFilename(filename: string): {
  author: string | null;
  year: number | null;
  journal: string | null;
  title: string;
} {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = nameWithoutExt.split("_");

  // Default values
  let author: string | null = null;
  let year: number | null = null;
  let journal: string | null = null;
  let title = nameWithoutExt;

  if (parts.length >= 4) {
    // Standard format: Author_Year_Journal_Title
    author = parts[0] !== "Unknown" ? parts[0].replace(/-/g, " ") : null;

    const yearNum = parseInt(parts[1]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
    }

    journal = parts[2] !== "Unknown" ? normalizeJournal(parts[2]) : null;
    title = parts.slice(3).join(" ").replace(/-/g, " ");
  } else if (parts.length >= 2) {
    // Try to extract author and year at minimum
    author = parts[0] !== "Unknown" ? parts[0].replace(/-/g, " ") : null;

    const yearNum = parseInt(parts[1]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
      title = parts.slice(2).join(" ").replace(/-/g, " ") || nameWithoutExt;
    } else {
      title = parts.slice(1).join(" ").replace(/-/g, " ");
    }
  }

  return { author, year, journal, title: title || nameWithoutExt };
}

// Normalize common journal abbreviations
function normalizeJournal(abbrev: string): string {
  const journalMap: Record<string, string> = {
    JBJS: "Journal of Bone and Joint Surgery",
    "JBJS-A": "Journal of Bone and Joint Surgery (American)",
    "JBJS-B": "Journal of Bone and Joint Surgery (British)",
    AJSM: "American Journal of Sports Medicine",
    CORR: "Clinical Orthopaedics and Related Research",
    JHS: "Journal of Hand Surgery",
    FAI: "Foot and Ankle International",
    Spine: "Spine",
    Arthroscopy: "Arthroscopy",
    JAAOS: "Journal of the American Academy of Orthopaedic Surgeons",
    JOT: "Journal of Orthopaedic Trauma",
    BJJ: "Bone & Joint Journal",
    KSSTA: "Knee Surgery, Sports Traumatology, Arthroscopy",
    JPO: "Journal of Pediatric Orthopaedics",
  };

  return journalMap[abbrev] || abbrev.replace(/-/g, " ");
}

// Determine subspecialty from path
function getSubspecialtyFromPath(filePath: string): Subspecialty {
  const parts = filePath.split(path.sep);

  for (const part of parts) {
    const mapped = FOLDER_SUBSPECIALTY_MAP[part];
    if (mapped) return mapped;

    // Try case-insensitive match
    for (const [folder, subspecialty] of Object.entries(
      FOLDER_SUBSPECIALTY_MAP
    )) {
      if (part.toLowerCase() === folder.toLowerCase()) {
        return subspecialty;
      }
    }
  }

  return "GENERAL";
}

async function scanDirectory(
  dirPath: string,
  basePath: string
): Promise<
  Array<{
    filename: string;
    filePath: string;
    fileSize: number;
    subspecialty: Subspecialty;
    documentType: DocumentType;
    metadata: ReturnType<typeof parseFilename>;
  }>
> {
  const results: Array<{
    filename: string;
    filePath: string;
    fileSize: number;
    subspecialty: Subspecialty;
    documentType: DocumentType;
    metadata: ReturnType<typeof parseFilename>;
  }> = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subResults = await scanDirectory(fullPath, basePath);
        results.push(...subResults);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        // Only index PDFs, PPT, and PPTX files
        if ([".pdf", ".ppt", ".pptx"].includes(ext)) {
          const fileStat = await stat(fullPath);
          const relativePath = path.relative(basePath, fullPath);

          results.push({
            filename: entry.name,
            filePath: relativePath,
            fileSize: fileStat.size,
            subspecialty: getSubspecialtyFromPath(relativePath),
            documentType: getDocumentType(entry.name, relativePath),
            metadata: parseFilename(entry.name),
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error);
  }

  return results;
}

async function main() {
  const documentsPath = process.env.DOCUMENTS_PATH;

  if (!documentsPath) {
    console.error("DOCUMENTS_PATH environment variable is not set");
    console.log("Please set DOCUMENTS_PATH in your .env file");
    process.exit(1);
  }

  console.log(`Scanning documents in: ${documentsPath}`);

  const documents = await scanDirectory(documentsPath, documentsPath);

  console.log(`Found ${documents.length} documents`);

  // Clear existing documents
  const deleteCount = await prisma.document.deleteMany();
  console.log(`Cleared ${deleteCount.count} existing documents`);

  // Insert new documents in batches
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    await prisma.document.createMany({
      data: batch.map((doc) => ({
        filename: doc.filename,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        title: doc.metadata.title,
        author: doc.metadata.author,
        year: doc.metadata.year,
        journal: doc.metadata.journal,
        subspecialty: doc.subspecialty,
        documentType: doc.documentType,
      })),
    });

    inserted += batch.length;
    console.log(`Indexed ${inserted}/${documents.length} documents...`);
  }

  // Print summary
  const summary = await prisma.document.groupBy({
    by: ["subspecialty"],
    _count: { subspecialty: true },
    orderBy: { subspecialty: "asc" },
  });

  console.log("\n=== Indexing Complete ===");
  console.log(`Total documents indexed: ${documents.length}`);
  console.log("\nBy subspecialty:");
  for (const item of summary) {
    console.log(`  ${item.subspecialty}: ${item._count.subspecialty}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
