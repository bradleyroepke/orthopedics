import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import { readdir } from "fs/promises";
import path from "path";

export interface CurriculumEntry {
  year: number;
  author: string;
  journal: string;
  title: string;
  description: string | null;
}

export interface CurriculumDocument {
  filename: string;
  displayName: string;
  entries: CurriculumEntry[];
}

// Map file names to display names
const FILE_DISPLAY_NAMES: Record<string, string> = {
  "FOOT AND ANKLE.docx": "Foot & Ankle",
  "FOOT _ ANKLE.docx": "Foot & Ankle",
  "GENERAL ARTICLES.docx": "General",
  "HAND TO ELBOW.docx": "Hand to Elbow",
  "HIP.docx": "Hip",
  "KNEE.docx": "Knee",
  "MSK ONCOLOGY.docx": "MSK Oncology",
  "PEDIATRICS.docx": "Pediatrics",
  "ROTATOR CUFF.docx": "Rotator Cuff",
  "SHOULDER ARTHROPLASTY.docx": "Shoulder Arthroplasty",
  "SHOULDER INSTABILITY.docx": "Shoulder Instability",
  "SHOULDER.docx": "Shoulder",
  "SPINE.docx": "Spine",
  "TRAUMA.docx": "Trauma",
};

// Skip these files
const SKIP_FILES = ["MUSINGS.docx"];

// Extract text from docx using raw XML
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

// Parse timeline format: "Year - Author, Journal" followed by "Title"
function parseTimelineEntries(paragraphs: string[]): CurriculumEntry[] {
  const entries: CurriculumEntry[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i].trim();

    // Match pattern: "1954 - Verbiest, JBJS" or "1954 - Verbiest, JBJS ⭐"
    const headerMatch = line.match(
      /^(\d{4})\s*[-–—]\s*([^,]+),\s*([A-Za-z0-9\s&]+)/
    );

    if (headerMatch) {
      const year = parseInt(headerMatch[1]);
      const author = headerMatch[2].trim();
      const journal = headerMatch[3].trim().replace(/[⭐\s]+$/, "");

      // Next line should be the title
      let title = "";
      let description: string | null = null;

      if (i + 1 < paragraphs.length) {
        const nextLine = paragraphs[i + 1].trim();
        // Check if next line looks like another header (year pattern)
        if (!nextLine.match(/^\d{4}\s*[-–—]/)) {
          title = nextLine;
          i++;

          // Check if there's a description (line after title that's not a header)
          if (i + 1 < paragraphs.length) {
            const descLine = paragraphs[i + 1].trim();
            if (
              !descLine.match(/^\d{4}\s*[-–—]/) &&
              descLine.length > 20 &&
              !descLine.match(/^\d{4}$/)
            ) {
              description = descLine;
              i++;
            }
          }
        }
      }

      if (title) {
        entries.push({
          year,
          author,
          journal,
          title,
          description,
        });
      }
    }
  }

  return entries;
}

export async function parseCurriculumDocuments(
  curriculumPath: string
): Promise<CurriculumDocument[]> {
  const files = await readdir(curriculumPath);
  const docxFiles = files.filter(
    (f) => f.endsWith(".docx") && !SKIP_FILES.includes(f)
  );

  const documents: CurriculumDocument[] = [];

  for (const file of docxFiles) {
    const filePath = path.join(curriculumPath, file);
    const paragraphs = await extractDocxText(filePath);
    const entries = parseTimelineEntries(paragraphs);

    if (entries.length > 0) {
      documents.push({
        filename: file,
        displayName: FILE_DISPLAY_NAMES[file] || file.replace(".docx", ""),
        entries,
      });
    }
  }

  // Sort by display name
  documents.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return documents;
}
