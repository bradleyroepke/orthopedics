import { readdir, writeFile } from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";

const CURRICULUM_PATH =
  process.env.CURRICULUM_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Curriculum";

const ARTICLES_PATH =
  process.env.ARTICLES_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

interface CurriculumEntry {
  subspecialty: string;
  year: number;
  journal: string;
  author: string;
  title: string;
  description: string;
  pdfFilename: string;
}

const FILE_SUBSPECIALTY_MAP: Record<string, string> = {
  "FOOT AND ANKLE.docx": "FOOT_AND_ANKLE",
  "FOOT _ ANKLE.docx": "FOOT_AND_ANKLE",
  "GENERAL ARTICLES.docx": "GENERAL",
  "HAND TO ELBOW.docx": "HAND",
  "HIP.docx": "HIP_AND_KNEE",
  "KNEE.docx": "HIP_AND_KNEE",
  "MSK ONCOLOGY.docx": "ONCOLOGY",
  "PEDIATRICS.docx": "PEDIATRICS",
  "ROTATOR CUFF.docx": "SHOULDER_AND_ELBOW",
  "SHOULDER ARTHROPLASTY.docx": "SHOULDER_AND_ELBOW",
  "SHOULDER INSTABILITY.docx": "SHOULDER_AND_ELBOW",
  "SHOULDER.docx": "SHOULDER_AND_ELBOW",
  "SPINE.docx": "SPINE",
  "TRAUMA.docx": "TRAUMA",
};

const SKIP_FILES = ["MUSINGS.docx"];

async function extractDocxText(filePath: string): Promise<string[]> {
  const zip = new AdmZip(filePath);
  const xmlContent = zip.readAsText("word/document.xml");
  const result = await parseStringPromise(xmlContent);
  const paragraphs: string[] = [];

  function extractText(node: unknown): string {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (typeof node === "object" && node !== null) {
      const obj = node as Record<string, unknown>;
      if ("_" in obj) return String(obj._);
      if ("w:t" in obj) return extractText(obj["w:t"]);
      if ("w:r" in obj) return extractText(obj["w:r"]);
      return Object.values(obj).map(extractText).join("");
    }
    return "";
  }

  const body = result?.["w:document"]?.["w:body"]?.[0];
  if (body && body["w:p"]) {
    for (const p of body["w:p"]) {
      const text = extractText(p).trim();
      if (text) paragraphs.push(text);
    }
  }

  return paragraphs;
}

function parseTimelineEntries(
  paragraphs: string[],
  subspecialty: string
): Omit<CurriculumEntry, "pdfFilename">[] {
  const entries: Omit<CurriculumEntry, "pdfFilename">[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i].trim();
    const headerMatch = line.match(
      /^(\d{4})\s*[-–—]\s*([^,]+),\s*([A-Za-z0-9\s&]+)/
    );

    if (headerMatch) {
      const year = parseInt(headerMatch[1]);
      const author = headerMatch[2].trim();
      const journal = headerMatch[3].trim().replace(/[⭐\s]+$/, "");

      let title = "";
      let description = "";

      if (i + 1 < paragraphs.length) {
        const nextLine = paragraphs[i + 1].trim();
        if (!nextLine.match(/^\d{4}\s*[-–—]/)) {
          title = nextLine;
          i++;

          if (i + 1 < paragraphs.length) {
            const descLine = paragraphs[i + 1].trim();
            if (
              !descLine.match(/^\d{4}\s*[-–—]/) &&
              descLine.length > 20 &&
              !descLine.match(/^\d{4}$/) &&
              !descLine.match(/^[0-9]+$/) // Skip numeric-only lines
            ) {
              description = descLine;
              i++;
            }
          }
        }
      }

      if (title && !title.match(/^[0-9]+$/)) {
        entries.push({
          subspecialty,
          year,
          journal,
          author,
          title,
          description: description.match(/^[0-9]+$/) ? "" : description,
        });
      }
    }
  }

  return entries;
}

interface PDFInfo {
  filename: string;
  year: string | null;
  author: string | null;
}

async function collectAllPDFs(): Promise<PDFInfo[]> {
  const pdfs: PDFInfo[] = [];

  async function scanDir(dirPath: string) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
          // Parse filename: YEAR_Author_Journal_Title.pdf
          const match = entry.name.match(/^(\d{4})_([^_]+)_/);
          pdfs.push({
            filename: entry.name,
            year: match?.[1] || null,
            author: match?.[2]?.toLowerCase() || null,
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  await scanDir(ARTICLES_PATH);
  return pdfs;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Very strict matching: exact year AND author must start with same letters
function findMatchingPDF(
  entry: Omit<CurriculumEntry, "pdfFilename">,
  pdfs: PDFInfo[]
): string | null {
  const entryYear = String(entry.year);
  const authorLast = normalize(entry.author.split(" ")[0].split(",")[0]);

  if (authorLast.length < 4) return null;

  // Find PDFs with exact year match
  const yearMatches = pdfs.filter((p) => p.year === entryYear);

  // Among year matches, find author that STARTS with same letters
  for (const pdf of yearMatches) {
    if (pdf.author && pdf.author.startsWith(authorLast.substring(0, 5))) {
      return pdf.filename;
    }
  }

  // Try with 4 chars if 5 didn't work
  for (const pdf of yearMatches) {
    if (pdf.author && pdf.author.startsWith(authorLast.substring(0, 4))) {
      return pdf.filename;
    }
  }

  return null;
}

function escapeCSV(field: string): string {
  const clean = field.replace(/[\x00-\x1F]/g, " ").trim();
  if (clean.includes(",") || clean.includes('"') || clean.includes("\n")) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

async function main() {
  console.log("=== Strict Curriculum to PDF Matching ===\n");

  console.log("Scanning Articles folder...");
  const pdfs = await collectAllPDFs();
  const parsedPDFs = pdfs.filter((p) => p.year && p.author);
  console.log(`Found ${pdfs.length} PDFs (${parsedPDFs.length} with parseable year_author format)\n`);

  console.log("Parsing curriculum files...");
  const files = await readdir(CURRICULUM_PATH);
  const docxFiles = files.filter(
    (f) => f.endsWith(".docx") && !SKIP_FILES.includes(f)
  );

  const allEntries: CurriculumEntry[] = [];
  let matched = 0;

  for (const file of docxFiles) {
    const subspecialty = FILE_SUBSPECIALTY_MAP[file];
    if (!subspecialty) continue;

    const filePath = path.join(CURRICULUM_PATH, file);
    const paragraphs = await extractDocxText(filePath);
    const entries = parseTimelineEntries(paragraphs, subspecialty);

    let fileMatched = 0;
    for (const entry of entries) {
      const pdfFilename = findMatchingPDF(entry, pdfs);
      if (pdfFilename) {
        matched++;
        fileMatched++;
      }

      allEntries.push({
        ...entry,
        pdfFilename: pdfFilename || "",
      });
    }

    console.log(`  ${file}: ${entries.length} entries, ${fileMatched} matched`);
  }

  console.log(`\nTotal: ${allEntries.length} entries`);
  console.log(`Matched: ${matched} (${Math.round((matched / allEntries.length) * 100)}%)`);
  console.log(`Unmatched: ${allEntries.length - matched}`);

  // Generate CSV
  const header = "Subspecialty,Year,Journal,Author,Title,Description,PDF_Filename";
  const rows = allEntries.map((e) =>
    [
      e.subspecialty,
      e.year,
      escapeCSV(e.journal),
      escapeCSV(e.author),
      escapeCSV(e.title),
      escapeCSV(e.description),
      escapeCSV(e.pdfFilename),
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const outputPath = path.join(process.cwd(), "curriculum-import-strict.csv");
  await writeFile(outputPath, csv, "utf-8");

  console.log(`\nCSV saved to: ${outputPath}`);

  // Show some sample matches
  console.log("\n=== Sample Matches ===");
  const matchedEntries = allEntries.filter((e) => e.pdfFilename);
  for (const e of matchedEntries.slice(0, 10)) {
    console.log(`${e.year} ${e.author} -> ${e.pdfFilename}`);
  }
}

main().catch(console.error);
