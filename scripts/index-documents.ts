import { PrismaClient } from "@prisma/client";

type Subspecialty = string;
type DocumentType = string;
import { readdir, stat } from "fs/promises";
import path from "path";
import { getTextbookMetadata, parseTextbookFilename } from "../src/lib/textbook-metadata";

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
  OITE: "OITE",
  "Past Exams": "OITE",
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
// Expected format: Year_Author_Journal_Title.pdf (e.g., 2019_Medda_JOT_Valgus Intertrochanteric.pdf)
function parseFilename(filename: string, isTextbook: boolean = false): {
  author: string | null;
  year: number | null;
  journal: string | null;
  title: string;
} {
  // Special handling for textbooks
  if (isTextbook) {
    const metadata = getTextbookMetadata(filename);
    if (metadata) {
      // Build full title with subtitle if available
      const fullTitle = metadata.subtitle
        ? `${metadata.title}: ${metadata.subtitle}`
        : metadata.title;
      return {
        author: metadata.author,
        year: metadata.year,
        journal: metadata.edition, // Store edition in journal field for textbooks
        title: fullTitle,
      };
    }

    // Fallback: parse textbook filename format (Author_Title_Edition_Year)
    const parsed = parseTextbookFilename(filename);
    return {
      author: parsed.author,
      year: parsed.year,
      journal: parsed.edition,
      title: parsed.title,
    };
  }

  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = nameWithoutExt.split("_");

  // Default values
  let author: string | null = null;
  let year: number | null = null;
  let journal: string | null = null;
  let title = nameWithoutExt;

  if (parts.length >= 4) {
    // Standard format: Year_Author_Journal_Title
    const yearNum = parseInt(parts[0]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
    }

    author = parts[1] !== "Unknown" ? parts[1].replace(/-/g, " ") : null;
    journal = parts[2] !== "Unknown" ? normalizeJournal(parts[2]) : null;
    title = parts.slice(3).join(" ").replace(/-/g, " ");
  } else if (parts.length >= 2) {
    // Try to extract year and author at minimum
    const yearNum = parseInt(parts[0]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
      author = parts[1] !== "Unknown" ? parts[1].replace(/-/g, " ") : null;
      title = parts.slice(2).join(" ").replace(/-/g, " ") || nameWithoutExt;
    } else {
      // Fallback: treat as title with underscores
      title = nameWithoutExt.replace(/_/g, " ");
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

// Extract year from folder path (e.g., "OITE/Past Exams/2016/file.pdf" -> 2016)
function getYearFromPath(filePath: string): number | null {
  const parts = filePath.split(path.sep);

  for (const part of parts) {
    // Check if folder name is a 4-digit year between 1990 and 2100
    const yearNum = parseInt(part);
    if (!isNaN(yearNum) && yearNum >= 1990 && yearNum <= 2100 && part.length === 4) {
      return yearNum;
    }
  }

  return null;
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

          const subspecialty = getSubspecialtyFromPath(relativePath);
          const isTextbook = subspecialty === "TEXTBOOKS";
          const isOITE = subspecialty === "OITE";

          // Parse metadata from filename
          const metadata = parseFilename(entry.name, isTextbook);

          // For OITE documents, try to extract year from folder path
          if (isOITE && !metadata.year) {
            const pathYear = getYearFromPath(relativePath);
            if (pathYear) {
              metadata.year = pathYear;
            }
          }

          results.push({
            filename: entry.name,
            filePath: relativePath,
            fileSize: fileStat.size,
            subspecialty,
            documentType: getDocumentType(entry.name, relativePath),
            metadata,
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
