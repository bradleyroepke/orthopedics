import { PrismaClient } from "@prisma/client";
import path from "path";
import { readdir } from "fs/promises";

const prisma = new PrismaClient();

const CURRICULUM_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRzLUHA1B0fcCoB0-iVoFR6fXhkkxoIwrhj0aAt9spgEOrpDB6T9-T4kIrbZnisYdaxeERqs282hhHN/pub?output=csv";

const ARTICLES_PATH =
  process.env.ARTICLES_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

interface CurriculumEntry {
  subspecialty: string;
  year: number | null;
  journal: string;
  author: string;
  title: string;
  description: string;
  pdfFilename: string;
}

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Fetch and parse curriculum from Google Sheets
async function fetchCurriculum(): Promise<CurriculumEntry[]> {
  console.log("Fetching curriculum from Google Sheets...");

  const response = await fetch(CURRICULUM_CSV_URL, {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch curriculum: ${response.status}`);
  }

  const csvText = await response.text();
  const lines = csvText.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    console.log("No data rows found in curriculum.");
    return [];
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_")
  );
  console.log("Columns found:", headers.join(", "));

  // Map column indices
  const colIndex = {
    subspecialty: headers.indexOf("subspecialty"),
    year: headers.indexOf("year"),
    journal: headers.indexOf("journal"),
    author: headers.indexOf("author"),
    title: headers.indexOf("title"),
    description: headers.indexOf("description"),
    pdfFilename: headers.indexOf("pdf_filename"),
  };

  // Parse data rows
  const entries: CurriculumEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Skip empty rows
    if (values.every((v) => !v)) continue;

    const subspecialty = values[colIndex.subspecialty] || "";
    const yearStr = values[colIndex.year] || "";
    const year = yearStr ? parseInt(yearStr) : null;

    // Skip rows without required fields
    if (!subspecialty || !values[colIndex.title]) continue;

    entries.push({
      subspecialty: subspecialty.toUpperCase().replace(/\s+/g, "_"),
      year: year && !isNaN(year) ? year : null,
      journal: values[colIndex.journal] || "Unknown",
      author: values[colIndex.author] || "Unknown",
      title: values[colIndex.title] || "",
      description: values[colIndex.description] || "",
      pdfFilename: values[colIndex.pdfFilename] || "",
    });
  }

  return entries;
}

// Map folder names to subspecialty codes
const FOLDER_SUBSPECIALTY_MAP: Record<string, string> = {
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
  "Musculoskeletal Oncology": "ONCOLOGY",
  Pediatrics: "PEDIATRICS",
  "Shoulder and Elbow": "SHOULDER_AND_ELBOW",
  Spine: "SPINE",
  "Sports Medicine": "SPORTS_MEDICINE",
  Trauma: "TRAUMA",
};

// Find all PDFs in Landmark folders
async function findLandmarkPDFs(): Promise<
  Map<string, { filename: string; filePath: string; subspecialty: string }>
> {
  const pdfMap = new Map<
    string,
    { filename: string; filePath: string; subspecialty: string }
  >();

  async function scanDir(dirPath: string, subspecialty: string) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (entry.name.toLowerCase().includes("landmark")) {
            // Found a landmark folder - scan its contents
            const subEntries = await readdir(fullPath, { withFileTypes: true });
            for (const subEntry of subEntries) {
              if (
                subEntry.isFile() &&
                subEntry.name.toLowerCase().endsWith(".pdf")
              ) {
                const relativePath = path.relative(
                  ARTICLES_PATH,
                  path.join(fullPath, subEntry.name)
                );
                pdfMap.set(subEntry.name.toLowerCase(), {
                  filename: subEntry.name,
                  filePath: relativePath,
                  subspecialty,
                });
              }
            }
          } else {
            // Check if this folder maps to a subspecialty
            const folderSubspecialty =
              FOLDER_SUBSPECIALTY_MAP[entry.name] || subspecialty;
            await scanDir(fullPath, folderSubspecialty);
          }
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }

  await scanDir(ARTICLES_PATH, "GENERAL");
  return pdfMap;
}

// Normalize text for matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Try to find matching PDF for a curriculum entry
function findMatchingPDF(
  entry: CurriculumEntry,
  pdfMap: Map<
    string,
    { filename: string; filePath: string; subspecialty: string }
  >
): { filename: string; filePath: string; subspecialty: string } | null {
  // 1. Exact filename match (if provided)
  if (entry.pdfFilename) {
    const exactMatch = pdfMap.get(entry.pdfFilename.toLowerCase());
    if (exactMatch) return exactMatch;
  }

  // 2. Try to match by year_author pattern
  if (entry.year && entry.author) {
    const pattern = `${entry.year}_${entry.author}`.toLowerCase();
    for (const [filename, info] of pdfMap) {
      if (filename.includes(pattern)) {
        return info;
      }
    }
  }

  // 3. Try to match by title keywords
  const titleWords = normalize(entry.title).split(" ").filter((w) => w.length > 4);
  if (titleWords.length > 0) {
    for (const [filename, info] of pdfMap) {
      const normalizedFilename = normalize(filename);
      const matchCount = titleWords.filter((word) =>
        normalizedFilename.includes(word)
      ).length;

      if (matchCount >= Math.min(3, titleWords.length)) {
        return info;
      }
    }
  }

  return null;
}

async function main() {
  console.log("=== Curriculum Import ===\n");

  // Fetch curriculum from Google Sheets
  const entries = await fetchCurriculum();
  console.log(`Found ${entries.length} curriculum entries\n`);

  if (entries.length === 0) {
    console.log("No entries to import. Add data to your Google Sheet first.");
    return;
  }

  // Find all PDFs in Landmark folders
  console.log("Scanning Landmark folders for PDFs...");
  const pdfMap = await findLandmarkPDFs();
  console.log(`Found ${pdfMap.size} PDFs in Landmark folders\n`);

  // Clear existing data
  console.log("Clearing existing data...");
  await prisma.landmarkArticle.deleteMany();
  await prisma.document.deleteMany();
  console.log("  Done\n");

  // Import entries
  console.log("Importing curriculum entries...");
  let imported = 0;
  let matched = 0;

  for (const entry of entries) {
    // Try to find matching PDF
    const pdfMatch = findMatchingPDF(entry, pdfMap);

    let documentId: string | null = null;

    if (pdfMatch) {
      // Create document record for the PDF
      const document = await prisma.document.create({
        data: {
          filename: pdfMatch.filename,
          filePath: pdfMatch.filePath,
          fileSize: 0, // We could get actual size if needed
          title: entry.title,
          author: entry.author !== "Unknown" ? entry.author : null,
          year: entry.year,
          journal: entry.journal !== "Unknown" ? entry.journal : null,
          subspecialty: entry.subspecialty,
          documentType: "ARTICLE",
        },
      });
      documentId = document.id;
      matched++;
    }

    // Create landmark article
    await prisma.landmarkArticle.create({
      data: {
        year: entry.year || 0,
        author: entry.author,
        journal: entry.journal,
        title: entry.title,
        description: entry.description || null,
        subspecialty: entry.subspecialty,
        documentId,
        matchConfidence: pdfMatch ? 1.0 : null,
        displayOrder: imported,
      },
    });

    imported++;

    if (imported % 25 === 0) {
      console.log(`  Imported ${imported}/${entries.length}...`);
    }
  }

  // Summary
  console.log("\n=== Import Complete ===");
  console.log(`Total landmark articles: ${imported}`);
  console.log(`Matched to PDFs: ${matched}`);
  console.log(`Missing PDFs: ${imported - matched}`);

  // Breakdown by subspecialty
  const summary = await prisma.landmarkArticle.groupBy({
    by: ["subspecialty"],
    _count: { subspecialty: true },
    orderBy: { _count: { subspecialty: "desc" } },
  });

  console.log("\nBy subspecialty:");
  for (const item of summary) {
    const withPdf = await prisma.landmarkArticle.count({
      where: {
        subspecialty: item.subspecialty,
        documentId: { not: null },
      },
    });
    console.log(
      `  ${item.subspecialty}: ${item._count.subspecialty} (${withPdf} with PDF)`
    );
  }

  console.log("\nView at: http://localhost:3000/landmarks");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
