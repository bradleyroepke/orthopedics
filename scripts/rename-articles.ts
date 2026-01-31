import { PrismaClient } from "@prisma/client";
import { readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { readFileSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import {
  JOURNAL_SEARCH_PATTERNS,
  AUTHOR_SUFFIXES,
  FILENAME_REPLACEMENTS,
} from "./lib/journal-mappings";

const prisma = new PrismaClient();

// Subspecialty folder mapping (from index-documents.ts)
const FOLDER_SUBSPECIALTY_MAP: Record<string, string> = {
  "Foot and Ankle": "FOOT_AND_ANKLE",
  Foot_and_Ankle: "FOOT_AND_ANKLE",
  FootAndAnkle: "FOOT_AND_ANKLE",
  Hand: "HAND",
  "Hip and Knee": "HIP_AND_KNEE",
  Hip_and_Knee: "HIP_AND_KNEE",
  HipAndKnee: "HIP_AND_KNEE",
  Hip: "HIP_AND_KNEE",
  Knee: "HIP_AND_KNEE",
  "Shoulder and Elbow": "SHOULDER_AND_ELBOW",
  Shoulder_and_Elbow: "SHOULDER_AND_ELBOW",
  ShoulderAndElbow: "SHOULDER_AND_ELBOW",
  Shoulder: "SHOULDER_AND_ELBOW",
  Elbow: "SHOULDER_AND_ELBOW",
  Spine: "SPINE",
  "Sports Medicine": "SPORTS_MEDICINE",
  Sports_Medicine: "SPORTS_MEDICINE",
  SportsMedicine: "SPORTS_MEDICINE",
  Sports: "SPORTS_MEDICINE",
  Trauma: "TRAUMA",
  Oncology: "ONCOLOGY",
  Pediatrics: "PEDIATRICS",
  Pediatric: "PEDIATRICS",
};

interface ExtractedMetadata {
  author: string | null;
  year: number | null;
  journal: string | null;
  title: string | null;
}

interface RenameEntry {
  currentFilename: string;
  currentPath: string;
  subspecialty: string;
  extractedAuthor: string | null;
  extractedYear: number | null;
  extractedJournal: string | null;
  extractedTitle: string | null;
  suggestedFilename: string;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  status: "pending" | "approved" | "skip";
  pdfTextPreview: string;
  filenameMetadata: ExtractedMetadata;
}

// Get subspecialty from path
function getSubspecialtyFromPath(filePath: string): string {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    const mapped = FOLDER_SUBSPECIALTY_MAP[part];
    if (mapped) return mapped;
    for (const [folder, subspecialty] of Object.entries(FOLDER_SUBSPECIALTY_MAP)) {
      if (part.toLowerCase() === folder.toLowerCase()) {
        return subspecialty;
      }
    }
  }
  return "GENERAL";
}

// Known journal abbreviations for filename parsing (order matters - longer/more specific first)
const FILENAME_JOURNALS_LIST = [
  // Longer abbreviations first to avoid partial matches
  "JAAOS", "JBJS", "AJSM", "CORR", "JSES", "KSSTA", "BJSM",
  "NEJM", "NEMJ", "JAMA", "JTIIC", "CRMM",
  // Spine journals
  "ESJ", "TSJ", "SJ", "Spine",
  // Hand journals (before generic matches)
  "HandClin", "Hand Clin",
  // Plastic surgery journals
  "BJPS", "AnnPlastSurg", "Ann Plast Surg", "PRS",
  // Other journals
  "JHS", "FAI", "JOT", "BJJ", "JPO", "BMJ", "CSS",
  "Arthroscopy", "Lancet",
  // Additional common abbreviations
  "JNS", "JBJS-A", "JBJS-B", "ICL",
];

const FILENAME_JOURNALS = new Set(FILENAME_JOURNALS_LIST);

// Scan filename for any known journal abbreviation
function findJournalInFilename(filename: string): string | null {
  const upper = filename.toUpperCase();

  // Check each journal abbreviation (longer ones first due to list order)
  for (const journal of FILENAME_JOURNALS_LIST) {
    const journalUpper = journal.toUpperCase();
    // Look for the journal as a word boundary (space, dash, underscore, or start/end)
    const pattern = new RegExp(`(?:^|[\\s_\\-])${journalUpper}(?:[\\s_\\-.]|$)`, "i");
    if (pattern.test(filename)) {
      return journal;
    }
  }

  return null;
}

// Extract metadata from existing filename
function parseExistingFilename(filename: string): ExtractedMetadata {
  const nameWithoutExt = filename.replace(/\.pdf$/i, "");

  let author: string | null = null;
  let year: number | null = null;
  let journal: string | null = null;
  let title: string | null = null;

  // Pattern 1: "YEAR - Author et al - Journal - Title" format
  // Example: "2001 - Rowe et al - JAAOS - DISH.pdf"
  const dashPattern = /^(\d{4})\s*-\s*([^-]+?)\s*(?:et\s*al\.?)?\s*-\s*([A-Za-z]+)\s*-\s*(.+)$/i;
  const dashMatch = nameWithoutExt.match(dashPattern);

  if (dashMatch) {
    const yearNum = parseInt(dashMatch[1]);
    if (yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
    }
    // Extract first author's last name
    const authorPart = dashMatch[2].trim();
    const authorMatch = authorPart.match(/^([A-Z][a-z]+)/);
    if (authorMatch) {
      author = authorMatch[1];
    }
    // Check if journal part is a known journal
    const journalPart = dashMatch[3].trim();
    if (FILENAME_JOURNALS.has(journalPart) || FILENAME_JOURNALS.has(journalPart.toUpperCase())) {
      journal = journalPart.toUpperCase() === "SPINE" ? "Spine" : journalPart;
    }
    title = dashMatch[4].trim();

    return { author, year, journal, title };
  }

  // Pattern 2: Underscore format "Author_Year_Journal_Title"
  const parts = nameWithoutExt.split("_");

  if (parts.length >= 4) {
    author = parts[0] !== "Unknown" ? parts[0].replace(/-/g, " ") : null;
    const yearNum = parseInt(parts[1]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
    }
    journal = parts[2] !== "Unknown" ? parts[2] : null;
    title = parts.slice(3).join(" ").replace(/-/g, " ");
  } else if (parts.length >= 2) {
    author = parts[0] !== "Unknown" ? parts[0].replace(/-/g, " ") : null;
    const yearNum = parseInt(parts[1]);
    if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
      title = parts.slice(2).join(" ").replace(/-/g, " ") || null;
    } else {
      title = parts.slice(1).join(" ").replace(/-/g, " ");
    }
  } else {
    title = nameWithoutExt.replace(/-/g, " ");
  }

  // If no journal found yet, scan the entire filename for known abbreviations
  if (!journal) {
    journal = findJournalInFilename(nameWithoutExt);
  }

  return { author, year, journal, title };
}

// Extract author from PDF text
function extractAuthor(text: string): string | null {
  const lines = text.split("\n").slice(0, 80); // First 80 lines

  // Common words to skip (not authors)
  const skipWords = new Set([
    "abstract", "introduction", "background", "methods", "results", "discussion",
    "conclusion", "review", "article", "clinical", "surgical", "management",
    "treatment", "diagnosis", "outcome", "evaluation", "comparison", "analysis",
    "reconstruction", "arthroplasty", "fracture", "injury", "technique",
    "posttraumatic", "combined", "shoulder", "elbow", "knee", "hip", "spine",
    "latissimus", "dorsi", "tendon", "ligament", "muscle", "bone", "joint",
  ]);

  // Pattern 1: "FirstName M. LastName, MD" or "FirstName LastName, MD/PhD"
  const mdPhDPattern = /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]{2,})(?:,?\s*(?:MD|M\.D\.|PhD|Ph\.D\.|DO|D\.O\.|FRCS|FACS))/;

  // Pattern 2: "LastName, FirstName" format
  const lastFirstPattern = /^([A-Z][a-z]{2,}),\s+[A-Z][a-z]+/;

  // Pattern 3: Department/affiliation line with author before it
  const deptPattern = /^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]{2,})\s*\*?\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 5 || line.length > 200) continue;

    // Skip title-like lines (they tend to be longer and descriptive)
    if (line.length > 80 && !line.includes(",")) continue;

    // Try MD/PhD pattern - most reliable
    const mdMatch = line.match(mdPhDPattern);
    if (mdMatch) {
      const name = cleanAuthorName(mdMatch[1]);
      if (name.length >= 3 && !skipWords.has(name.toLowerCase())) {
        return name;
      }
    }

    // Try last, first pattern
    const lastFirstMatch = line.match(lastFirstPattern);
    if (lastFirstMatch) {
      const name = lastFirstMatch[1];
      if (name.length >= 3 && !skipWords.has(name.toLowerCase())) {
        return name;
      }
    }

    // Try department pattern (author name alone on a line, followed by department)
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].toLowerCase();
      if (nextLine.includes("department") || nextLine.includes("university") ||
          nextLine.includes("hospital") || nextLine.includes("school of medicine")) {
        const deptMatch = line.match(deptPattern);
        if (deptMatch) {
          const name = cleanAuthorName(deptMatch[1]);
          if (name.length >= 3 && !skipWords.has(name.toLowerCase())) {
            return name;
          }
        }
      }
    }
  }

  return null;
}

// Clean author name by removing suffixes and "et al"
function cleanAuthorName(name: string): string {
  let cleaned = name.trim();

  // Remove "et al" variations
  cleaned = cleaned.replace(/\s*et\s*al\.?\s*$/i, "").trim();

  for (const suffix of AUTHOR_SUFFIXES) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length);
    }
  }
  // Extract just last name if full name
  const parts = cleaned.split(/\s+/);
  if (parts.length > 1) {
    // Return last word as last name (handle "John A. Smith" -> "Smith")
    return parts[parts.length - 1];
  }
  return cleaned;
}

// Extract year from PDF text
function extractYear(text: string): number | null {
  const currentYear = new Date().getFullYear();

  // Pattern 1: Copyright year - most reliable
  const copyrightMatch = text.match(/(?:©|copyright|\(c\))\s*(\d{4})/i);
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1]);
    if (year >= 1950 && year <= currentYear) return year;
  }

  // Pattern 2: Published/received date
  const publishedMatch = text.match(/(?:published|received|accepted)\s*:?\s*(?:\w+\s+)?(\d{4})/i);
  if (publishedMatch) {
    const year = parseInt(publishedMatch[1]);
    if (year >= 1950 && year <= currentYear) return year;
  }

  // Pattern 3: Volume/Issue year pattern (e.g., "Volume 82-A, No. 8, August 2000")
  const volumeMatch = text.match(/(?:volume|vol\.?)\s*\d+[A-Za-z-]*\s*,?\s*(?:no\.?|issue)\s*\d+\s*,?\s*\w*\s*(\d{4})/i);
  if (volumeMatch) {
    const year = parseInt(volumeMatch[1]);
    if (year >= 1950 && year <= currentYear) return year;
  }

  // Pattern 4: Find years in first portion of text, pick most common or first reasonable one
  const first2000Chars = text.slice(0, 2000);
  const yearMatches = first2000Chars.match(/\b(19[5-9]\d|20[0-2]\d)\b/g);
  if (yearMatches && yearMatches.length > 0) {
    // Count occurrences
    const yearCounts: Record<number, number> = {};
    for (const y of yearMatches) {
      const year = parseInt(y);
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
    // Return most frequent year
    const sorted = Object.entries(yearCounts).sort((a, b) => b[1] - a[1]);
    return parseInt(sorted[0][0]);
  }

  return null;
}

// Extract journal from PDF text
function extractJournal(text: string): string | null {
  // Journal names appear in different locations depending on the journal:
  // - JAAOS: BOTTOM of first page (footer)
  // - JBJS: TOP of first page (header)
  // - Many journals: Page periphery (headers, footers, margins)

  // Search the first page more thoroughly (first 6000 chars covers most first pages)
  // This includes both header and footer of the first page
  const firstPageText = text.slice(0, 6000).toLowerCase();

  // Also check the document footer area (last 2500 chars)
  const footerText = text.slice(-2500).toLowerCase();

  // Combine for searching
  const searchText = firstPageText + " " + footerText;

  // Priority order: more specific patterns first
  // IMPORTANT: "hand clin" must come BEFORE "clin orthop" to avoid false CORR matches
  const journalPriority: [string, string[]][] = [
    // Most specific full names first
    ["JAnat", ["journal of anatomy", "j. anat.", "j.anat.", "j anat"]],
    ["JAAOS", ["journal of the american academy of orthopaedic surgeons", "j am acad orthop surg", "american academy of orthopaedic surgeons"]],
    ["JSES", ["journal of shoulder and elbow surgery", "j shoulder elbow surg", "shoulder elbow surg"]],
    ["AJSM", ["american journal of sports medicine", "am j sports med"]],
    ["JBJS", ["journal of bone and joint surgery", "j bone joint surg", "bone and joint surgery"]],
    // Hand Clinics BEFORE CORR to avoid "clin" matching
    ["HandClin", ["hand clinics", "hand clin"]],
    ["CORR", ["clinical orthopaedics and related research", "clin orthop relat res"]],
    ["Arthroscopy", ["arthroscopy: the journal", "arthroscopy journal", "arthroscopy the journal of arthroscopic"]],
    ["JOT", ["journal of orthopaedic trauma", "j orthop trauma", "orthopaedic trauma association"]],
    ["JHS", ["journal of hand surgery", "j hand surg"]],
    ["FAI", ["foot and ankle international", "foot ankle int"]],
    ["BJJ", ["bone and joint journal", "bone joint j"]],
    ["JArthroplasty", ["journal of arthroplasty", "j arthroplasty"]],
    ["JPO", ["journal of pediatric orthopaedics", "j pediatr orthop"]],
    ["KSSTA", ["knee surgery sports traumatology", "knee surg sports traumatol"]],
    ["BJSM", ["british journal of sports medicine", "br j sports med"]],
    ["ESJ", ["european spine journal", "eur spine j"]],
    ["Spine", ["spine journal", "the spine journal"]],
    ["NEJM", ["new england journal of medicine", "n engl j med"]],
    ["JAMA", ["journal of the american medical association"]],
    ["Lancet", ["the lancet", "lancet"]],
    // Plastic surgery journals
    ["BJPS", ["british journal of plastic surgery", "br j plast surg"]],
    ["AnnPlastSurg", ["annals of plastic surgery", "ann plast surg"]],
    ["PRS", ["plastic and reconstructive surgery", "plast reconstr surg"]],
    // Less specific abbreviations last
    ["JAAOS", ["jaaos"]],
    ["JSES", ["jses"]],
    ["AJSM", ["ajsm"]],
    ["JBJS", ["jbjs"]],
    ["CORR", ["corr"]],
    ["JOT", ["jot"]],
    ["HandClin", ["handclin"]],
    ["BJPS", ["bjps"]],
  ];

  for (const [abbrev, patterns] of journalPriority) {
    for (const pattern of patterns) {
      if (searchText.includes(pattern)) {
        return abbrev;
      }
    }
  }

  return null;
}

// Extract title from PDF text
function extractTitle(text: string): string | null {
  const lines = text.split("\n").slice(0, 40); // First 40 lines

  // Patterns to skip (metadata, not titles)
  const skipPatterns = [
    /^(?:abstract|introduction|background|methods|results|conclusion)/i,
    /^(?:copyright|volume|issue|received|accepted|published|doi)/i,
    /^(?:see discussions|researchgate|downloaded from|available at)/i,
    /^(?:https?:\/\/|www\.)/i,
    /^(?:review article|original article|case report|editorial)/i,
    /^\d+\s*$/,  // Just numbers
    /^page\s+\d+/i,
    /citation/i,
    /author\s+profiles?/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip short lines or very long lines
    if (trimmed.length < 15 || trimmed.length > 200) continue;

    // Skip all uppercase lines (usually journal headers)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 10) continue;

    // Skip lines that look like author lines
    if (/(?:MD|PhD|DO|FRCS|,\s*[A-Z]{2,3}$)/.test(trimmed)) continue;

    // Skip metadata patterns
    let skip = false;
    for (const pattern of skipPatterns) {
      if (pattern.test(trimmed)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    // Skip lines with too many special chars or URLs
    if ((trimmed.match(/[/:@]/g) || []).length > 2) continue;

    // This might be a title - check if it starts with capital letter
    if (/^[A-Z]/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

// Extract metadata from PDF content
async function extractPdfMetadata(filePath: string): Promise<{ metadata: ExtractedMetadata; textPreview: string }> {
  try {
    const dataBuffer = readFileSync(filePath);
    const data = await pdfParse(dataBuffer, { max: 2 }); // Only first 2 pages

    const text = data.text || "";
    const textPreview = text.slice(0, 500).replace(/\n+/g, " ").trim();

    return {
      metadata: {
        author: extractAuthor(text),
        year: extractYear(text),
        journal: extractJournal(text),
        title: extractTitle(text),
      },
      textPreview,
    };
  } catch (error) {
    return {
      metadata: { author: null, year: null, journal: null, title: null },
      textPreview: `Error extracting PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Split CamelCase into separate words
function splitCamelCase(text: string): string {
  // Insert space before uppercase letters that follow lowercase letters
  // e.g., "CentralCordSyndrome" -> "Central Cord Syndrome"
  let result = text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  // Handle stuck-together words ending with common prepositions
  // Match word ending in "in", "of", "and", etc. followed by space and capital
  result = result
    .replace(/(\w+)in (?=[A-Z])/g, "$1 in ")      // "Advancesin Management" -> "Advances in Management"
    .replace(/(\w+)of (?=[A-Z])/g, "$1 of ")      // "Managementof Spinal" -> "Management of Spinal"
    .replace(/(\w+)and (?=[A-Z])/g, "$1 and ")    // "Infantsand Children" -> "Infants and Children"
    .replace(/(\w+)the (?=[A-Z])/g, "$1 the ")    // "inthe Spine" -> "in the Spine"
    .replace(/(\w+)for (?=[A-Z])/g, "$1 for ")    // "Treatmentfor" -> "Treatment for"
    .replace(/(\w+)with (?=[A-Z])/g, "$1 with "); // "Patientwith" -> "Patient with"

  return result;
}

// Convert to Title Case (capitalize major words)
function toTitleCase(text: string): string {
  const minorWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "through", "during", "before",
    "after", "above", "below", "between", "under", "vs", "vs."
  ]);

  return text
    .split(" ")
    .map((word, index) => {
      if (word.length === 0) return word;
      const lowerWord = word.toLowerCase();
      // Always capitalize first word, and major words
      if (index === 0 || !minorWords.has(lowerWord)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return lowerWord;
    })
    .join(" ");
}

// Generate standardized filename
// Format: Year_Author_Journal_Title (no .pdf extension, Title Case applied)
function generateFilename(
  author: string | null,
  year: number | null,
  journal: string | null,
  title: string | null
): string {
  const yearPart = year?.toString() || "Unknown";
  const authorPart = author || "Unknown";
  const journalPart = journal || "Unknown";

  let titlePart = title || "Untitled";

  // Split CamelCase into words
  titlePart = splitCamelCase(titlePart);

  // Clean up title for filename - remove problematic chars but keep spaces
  for (const [char, replacement] of Object.entries(FILENAME_REPLACEMENTS)) {
    titlePart = titlePart.split(char).join(replacement);
  }

  // Normalize multiple spaces to single space
  titlePart = titlePart.replace(/\s+/g, " ").trim();

  // Apply Title Case
  titlePart = toTitleCase(titlePart);

  // Truncate title to 50 chars at word boundary
  if (titlePart.length > 50) {
    titlePart = titlePart.slice(0, 50);
    const lastSpace = titlePart.lastIndexOf(" ");
    if (lastSpace > 30) {
      titlePart = titlePart.slice(0, lastSpace);
    }
  }

  return `${yearPart}_${authorPart}_${journalPart}_${titlePart}`;
}

// Calculate confidence score
function calculateConfidence(
  extracted: ExtractedMetadata,
  fromFilename: ExtractedMetadata
): { score: number; level: "high" | "medium" | "low" } {
  let score = 0;

  // Author found (from PDF or filename)
  if (extracted.author || fromFilename.author) score += 0.25;

  // Year found and valid
  if (extracted.year || fromFilename.year) score += 0.25;

  // Journal found
  if (extracted.journal || fromFilename.journal) score += 0.25;

  // Title found and reasonable length
  const title = extracted.title || fromFilename.title;
  if (title && title.length > 10) score += 0.25;

  const level = score > 0.7 ? "high" : score >= 0.4 ? "medium" : "low";
  return { score, level };
}

// Scan directory for PDF files
async function scanArticles(
  dirPath: string,
  basePath: string,
  filterSubspecialty?: string
): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip non-article folders
        if (
          entry.name.toLowerCase().includes("textbook") ||
          entry.name.toLowerCase().includes("oite") ||
          entry.name.toLowerCase().includes("presentation") ||
          entry.name.toLowerCase().includes("timeline")
        ) {
          continue;
        }

        // If filtering by subspecialty, check folder name
        if (filterSubspecialty) {
          const folderSubspecialty = FOLDER_SUBSPECIALTY_MAP[entry.name];
          if (folderSubspecialty && folderSubspecialty !== filterSubspecialty) {
            continue;
          }
        }

        const subResults = await scanArticles(fullPath, basePath, filterSubspecialty);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        const relativePath = path.relative(basePath, fullPath);
        if (filterSubspecialty) {
          const subspecialty = getSubspecialtyFromPath(relativePath);
          if (subspecialty === filterSubspecialty) {
            results.push(fullPath);
          }
        } else {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error);
  }

  return results;
}

async function main() {
  const articlesPath =
    process.env.ARTICLES_PATH ||
    "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

  // Parse command line arguments
  const args = process.argv.slice(2);
  let filterSubspecialty: string | undefined;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--subspecialty" && args[i + 1]) {
      filterSubspecialty = args[i + 1].toUpperCase().replace(/-/g, "_");
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    }
  }

  console.log(`Scanning articles in: ${articlesPath}`);
  if (filterSubspecialty) {
    console.log(`Filtering by subspecialty: ${filterSubspecialty}`);
  }
  if (limit) {
    console.log(`Limiting to ${limit} files`);
  }

  let files = await scanArticles(articlesPath, articlesPath, filterSubspecialty);

  if (limit) {
    files = files.slice(0, limit);
  }

  console.log(`Found ${files.length} PDF files to analyze\n`);

  const entries: RenameEntry[] = [];
  let processed = 0;

  for (const filePath of files) {
    processed++;
    const filename = path.basename(filePath);
    const relativePath = path.relative(articlesPath, filePath);
    const subspecialty = getSubspecialtyFromPath(relativePath);

    if (processed % 50 === 0) {
      console.log(`Processing ${processed}/${files.length}...`);
    }

    // Extract metadata from filename
    const filenameMetadata = parseExistingFilename(filename);

    // Extract metadata from PDF
    const { metadata: pdfMetadata, textPreview } = await extractPdfMetadata(filePath);

    // Helper to check if a value looks valid (not just numbers/garbage)
    const isValidAuthor = (s: string | null) => s && /^[A-Z][a-z]+$/.test(s);
    const isValidTitle = (s: string | null) => s && s.length > 5 && !/^\d+$/.test(s);

    // Merge metadata (prefer filename over PDF when filename has valid structured data)
    const merged: ExtractedMetadata = {
      author: isValidAuthor(filenameMetadata.author) ? filenameMetadata.author : (pdfMetadata.author || filenameMetadata.author),
      year: filenameMetadata.year || pdfMetadata.year,
      journal: filenameMetadata.journal || pdfMetadata.journal,
      title: isValidTitle(filenameMetadata.title) ? filenameMetadata.title : (pdfMetadata.title || filenameMetadata.title),
    };

    // Calculate confidence
    const { score, level } = calculateConfidence(pdfMetadata, filenameMetadata);

    // Generate suggested filename
    const suggestedFilename = generateFilename(
      merged.author,
      merged.year,
      merged.journal,
      merged.title
    );

    entries.push({
      currentFilename: filename,
      currentPath: relativePath,
      subspecialty,
      extractedAuthor: merged.author,
      extractedYear: merged.year,
      extractedJournal: merged.journal,
      extractedTitle: merged.title,
      suggestedFilename,
      confidence: score,
      confidenceLevel: level,
      status: "pending",
      pdfTextPreview: textPreview,
      filenameMetadata,
    });
  }

  // Generate output files
  const timestamp = new Date().toISOString().split("T")[0];
  const csvPath = path.join(process.cwd(), `rename-review-${timestamp}.csv`);
  const jsonPath = path.join(process.cwd(), `rename-review-${timestamp}.json`);

  // CSV output
  const csvHeader = [
    "current_filename",
    "subspecialty",
    "extracted_author",
    "extracted_year",
    "extracted_journal",
    "extracted_title",
    "suggested_filename",
    "confidence",
    "confidence_level",
    "status",
  ].join(",");

  const csvRows = entries.map((e) =>
    [
      `"${e.currentFilename.replace(/"/g, '""')}"`,
      e.subspecialty,
      `"${(e.extractedAuthor || "").replace(/"/g, '""')}"`,
      e.extractedYear || "",
      `"${(e.extractedJournal || "").replace(/"/g, '""')}"`,
      `"${(e.extractedTitle || "").replace(/"/g, '""')}"`,
      `"${e.suggestedFilename.replace(/"/g, '""')}"`,
      e.confidence.toFixed(2),
      e.confidenceLevel,
      e.status,
    ].join(",")
  );

  await writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));
  console.log(`\nCSV review file written to: ${csvPath}`);

  // JSON output with full details
  await writeFile(jsonPath, JSON.stringify(entries, null, 2));
  console.log(`JSON details file written to: ${jsonPath}`);

  // Print summary
  const highConfidence = entries.filter((e) => e.confidenceLevel === "high").length;
  const mediumConfidence = entries.filter((e) => e.confidenceLevel === "medium").length;
  const lowConfidence = entries.filter((e) => e.confidenceLevel === "low").length;

  console.log("\n=== Analysis Complete ===");
  console.log(`Total files analyzed: ${entries.length}`);
  console.log(`High confidence: ${highConfidence} (${((highConfidence / entries.length) * 100).toFixed(1)}%)`);
  console.log(`Medium confidence: ${mediumConfidence} (${((mediumConfidence / entries.length) * 100).toFixed(1)}%)`);
  console.log(`Low confidence: ${lowConfidence} (${((lowConfidence / entries.length) * 100).toFixed(1)}%)`);

  // Subspecialty breakdown
  const bySubspecialty: Record<string, number> = {};
  for (const e of entries) {
    bySubspecialty[e.subspecialty] = (bySubspecialty[e.subspecialty] || 0) + 1;
  }
  console.log("\nBy subspecialty:");
  for (const [sub, count] of Object.entries(bySubspecialty).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sub}: ${count}`);
  }

  console.log("\nNext steps:");
  console.log("1. Open the CSV file in Excel");
  console.log("2. Review and correct suggested filenames");
  console.log("3. Change 'status' from 'pending' to 'approved' for files to rename");
  console.log("4. Run: npm run rename:apply -- --input rename-review-YYYY-MM-DD.csv");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
