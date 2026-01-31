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
  JOURNAL_ABBREVIATIONS,
} from "./lib/journal-mappings";
import { searchByTitle } from "./lib/scopus-lookup";

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
  // General orthopaedics
  "JOrthop", "J Orthopaedics",
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

// Words that are NOT valid author names (medical/anatomical terms often in titles)
const INVALID_AUTHOR_WORDS = new Set([
  // Anatomical terms
  "valgus", "varus", "femoral", "tibial", "humeral", "radial", "ulnar",
  "distal", "proximal", "anterior", "posterior", "medial", "lateral",
  "periprosthetic", "intertrochanteric", "supracondylar", "subtrochanteric",
  // Medical terms
  "acute", "chronic", "surgical", "clinical", "primary", "revision",
  "total", "partial", "open", "closed", "stable", "unstable",
  // Common title starters
  "the", "a", "an", "new", "novel", "modern", "current", "recent",
  "very", "early", "late", "long", "short", "high", "low",
  // Procedure/condition terms
  "fracture", "fractures", "osteotomy", "arthroplasty", "arthroscopy",
  "reconstruction", "repair", "fixation", "replacement", "fusion",
  // Comparison words
  "comparison", "versus", "evaluation", "analysis", "review", "outcomes",
]);

// Check if a string looks like a valid author last name
function isValidAuthorName(name: string): boolean {
  if (!name || name.length < 2) return false;
  // Must start with capital, rest lowercase (typical last name pattern)
  if (!/^[A-Z][a-z]+$/.test(name)) return false;
  // Must not be a known invalid word
  if (INVALID_AUTHOR_WORDS.has(name.toLowerCase())) return false;
  return true;
}

// Extract metadata from existing filename
function parseExistingFilename(filename: string): ExtractedMetadata {
  const nameWithoutExt = filename.replace(/\.pdf$/i, "");
  // Also remove common download suffixes like .14, .98043, (1), etc.
  const cleanedName = nameWithoutExt.replace(/\.\d+$/, "").replace(/\s*\(\d+\)$/, "");

  let author: string | null = null;
  let year: number | null = null;
  let journal: string | null = null;
  let title: string | null = null;

  // Pattern 1: "YEAR - Author et al - Journal - Title" format
  // Example: "2001 - Rowe et al - JAAOS - DISH.pdf"
  const dashPattern = /^(\d{4})\s*-\s*([^-]+?)\s*(?:et\s*al\.?)?\s*-\s*([A-Za-z]+)\s*-\s*(.+)$/i;
  const dashMatch = cleanedName.match(dashPattern);

  if (dashMatch) {
    const yearNum = parseInt(dashMatch[1]);
    if (yearNum >= 1900 && yearNum <= 2100) {
      year = yearNum;
    }
    // Extract first author's last name
    const authorPart = dashMatch[2].trim();
    const authorMatch = authorPart.match(/^([A-Z][a-z]+)/);
    if (authorMatch && isValidAuthorName(authorMatch[1])) {
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
  // BUT only use this if the parts actually validate as author/year/journal
  const parts = cleanedName.split("_");

  if (parts.length >= 4) {
    const potentialAuthor = parts[0];
    const potentialYear = parseInt(parts[1]);
    const potentialJournal = parts[2];

    // Validate: author must look like a name, year must be valid, journal must be known
    const authorValid = isValidAuthorName(potentialAuthor);
    const yearValid = !isNaN(potentialYear) && potentialYear >= 1950 && potentialYear <= 2100;
    const journalValid = FILENAME_JOURNALS.has(potentialJournal) ||
                         FILENAME_JOURNALS.has(potentialJournal.toUpperCase());

    if (authorValid && yearValid && journalValid) {
      // This looks like a properly structured filename
      author = potentialAuthor;
      year = potentialYear;
      journal = potentialJournal;
      title = parts.slice(3).join(" ").replace(/-/g, " ");
      return { author, year, journal, title };
    }

    // Not a structured filename - treat underscores as spaces in title
    title = cleanedName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  } else if (parts.length >= 2) {
    // Check for "Author_Year" or similar partial patterns
    const potentialAuthor = parts[0];
    const potentialYear = parseInt(parts[1]);

    if (isValidAuthorName(potentialAuthor) && !isNaN(potentialYear) &&
        potentialYear >= 1950 && potentialYear <= 2100) {
      author = potentialAuthor;
      year = potentialYear;
      title = parts.slice(2).join(" ").replace(/-/g, " ") || null;
    } else {
      // Not structured - treat as title with underscores
      title = cleanedName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    }
  } else {
    title = cleanedName.replace(/-/g, " ");
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
    // Section headings
    "abstract", "introduction", "background", "methods", "results", "discussion",
    "conclusion", "review", "article", "etiology", "overview", "summary",
    // Medical terms
    "clinical", "surgical", "management", "treatment", "diagnosis", "outcome",
    "evaluation", "comparison", "analysis", "reconstruction", "arthroplasty",
    "fracture", "injury", "technique", "posttraumatic", "combined",
    // Anatomy terms
    "shoulder", "elbow", "knee", "hip", "spine", "femoral", "valgus", "varus",
    "latissimus", "dorsi", "tendon", "ligament", "muscle", "bone", "joint",
    "distal", "proximal", "anterior", "posterior", "medial", "lateral",
    // Institutional terms (often appear before author names)
    "orthopaedics", "orthopedics", "orthopaedic", "orthopedic",
    "university", "hospital", "center", "centre", "institute", "department",
    "permanente", "midlands", "association", "academy", "society", "college",
    "unit", "care", "health", "medical", "medicine", "surgery", "sciences",
    // Geographic/institutional names
    "ontario", "california", "boston", "london", "chicago", "mayo", "cleveland",
    // Title words that get misextracted
    "structure", "composition", "function", "basic", "science", "current",
    "update", "advances", "modern", "contemporary", "comprehensive", "guide",
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
    ["JOrthop", ["journal of orthopaedics", "j orthopaedics", "j orthop"]],
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

// Map full journal name to our abbreviation
function mapJournalToAbbrev(journalName: string): string {
  if (!journalName) return "";

  // Check direct mapping
  const abbrev = JOURNAL_ABBREVIATIONS[journalName];
  if (abbrev) return abbrev;

  // Check case-insensitive
  const lower = journalName.toLowerCase();
  for (const [name, ab] of Object.entries(JOURNAL_ABBREVIATIONS)) {
    if (name.toLowerCase() === lower) return ab;
  }

  // Check if journal name contains known patterns
  for (const [ab, patterns] of Object.entries(JOURNAL_SEARCH_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) return ab;
    }
  }

  // Additional mappings for common Scopus journal names
  const scopusJournalMap: Record<string, string> = {
    "pain": "Pain",
    "injury": "Injury",
    "knee": "Knee",
    "hand": "Hand",
    "spine": "Spine",
    "current opinion in anaesthesiology": "CurrOpinAnesth",
    "journal of pain": "JPain",
    "journal of orthopaedics": "JOrthop",
  };

  for (const [pattern, ab] of Object.entries(scopusJournalMap)) {
    if (lower.includes(pattern)) return ab;
  }

  // Return shortened version of original name (take first letters of each word)
  const words = journalName.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    return words.slice(0, 3).map(w => w[0].toUpperCase() + w.slice(1, 3).toLowerCase()).join("");
  }
  return journalName.slice(0, 10);
}

// Calculate similarity between two strings (word overlap with simple stemming)
function titleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  // Simple stemming: remove common suffixes
  const stem = (word: string) => {
    return word
      .replace(/(?:ing|ed|s|ly|tion|ment)$/i, "")
      .replace(/(?:ies)$/i, "y");
  };

  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3)  // Require 4+ chars
      .map(stem);

  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }

  // Return ratio of matching words to smaller set
  const minSize = Math.min(wordsA.size, wordsB.size);
  return matches / minSize;
}

// Lookup article in Scopus by title
async function lookupScopus(title: string): Promise<ExtractedMetadata | null> {
  if (!title || title.length < 15) return null;

  try {
    const result = await searchByTitle(title);
    if (result.found && result.article) {
      const article = result.article;

      // Verify the result is actually relevant (avoid false positives)
      const similarity = titleSimilarity(title, article.title);
      if (similarity < 0.4) {
        // Less than 40% word overlap - likely a false positive
        return null;
      }

      // Also verify it's a medical/orthopaedic journal (not business, economics, etc.)
      const journalLower = article.journal.toLowerCase();
      const nonMedicalJournals = [
        "business", "economics", "management", "finance", "marketing",
        "accounting", "cuadernos", "review of", "journal of business",
      ];
      if (nonMedicalJournals.some(term => journalLower.includes(term))) {
        return null;
      }

      return {
        author: article.firstAuthor || null,
        year: article.year || null,
        journal: mapJournalToAbbrev(article.journal) || null,
        title: article.title || null,
      };
    }
  } catch (error) {
    // Silently fail - will fall back to PDF extraction
  }
  return null;
}

// Rate limiter for Scopus API (10 requests per second max)
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  let useScopus = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--subspecialty" && args[i + 1]) {
      filterSubspecialty = args[i + 1].toUpperCase().replace(/-/g, "_");
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === "--scopus") {
      useScopus = true;
    }
  }

  console.log(`Scanning articles in: ${articlesPath}`);
  if (filterSubspecialty) {
    console.log(`Filtering by subspecialty: ${filterSubspecialty}`);
  }
  if (limit) {
    console.log(`Limiting to ${limit} files`);
  }
  if (useScopus) {
    console.log(`Scopus API lookup: ENABLED`);
  }

  let files = await scanArticles(articlesPath, articlesPath, filterSubspecialty);

  if (limit) {
    files = files.slice(0, limit);
  }

  console.log(`Found ${files.length} PDF files to analyze\n`);

  const entries: RenameEntry[] = [];
  let processed = 0;
  let scopusMatches = 0;

  for (const filePath of files) {
    processed++;
    const filename = path.basename(filePath);
    const relativePath = path.relative(articlesPath, filePath);
    const subspecialty = getSubspecialtyFromPath(relativePath);

    if (processed % 50 === 0) {
      const scopusInfo = useScopus ? ` (Scopus: ${scopusMatches} matches)` : "";
      console.log(`Processing ${processed}/${files.length}...${scopusInfo}`);
    }

    // Extract metadata from filename
    const filenameMetadata = parseExistingFilename(filename);

    // Extract metadata from PDF
    const { metadata: pdfMetadata, textPreview } = await extractPdfMetadata(filePath);

    // Scopus lookup (if enabled) - use title from PDF or filename
    let scopusMetadata: ExtractedMetadata | null = null;
    if (useScopus) {
      const searchTitle = pdfMetadata.title || filenameMetadata.title;
      if (searchTitle && searchTitle.length >= 20) {
        scopusMetadata = await lookupScopus(searchTitle);
        if (scopusMetadata?.author) {
          scopusMatches++;
          // Add small delay to avoid rate limiting (100ms between requests)
          await sleep(100);
        }
      }
    }

    // Helper to check if a value looks valid (not just numbers/garbage)
    const isValidAuthor = (s: string | null) => s && /^[A-Z][a-z]+$/.test(s);
    const isValidTitle = (s: string | null) => s && s.length > 5 && !/^\d+$/.test(s);

    // Merge metadata - priority: Scopus > filename (if structured) > PDF
    const merged: ExtractedMetadata = {
      author: scopusMetadata?.author ||
              (isValidAuthor(filenameMetadata.author) ? filenameMetadata.author : null) ||
              pdfMetadata.author ||
              filenameMetadata.author,
      year: scopusMetadata?.year || filenameMetadata.year || pdfMetadata.year,
      journal: scopusMetadata?.journal || filenameMetadata.journal || pdfMetadata.journal,
      title: scopusMetadata?.title ||
             (isValidTitle(filenameMetadata.title) ? filenameMetadata.title : null) ||
             pdfMetadata.title ||
             filenameMetadata.title,
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
    "current_path",
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
      `"${e.currentPath.replace(/"/g, '""')}"`,
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
  if (useScopus) {
    console.log(`Scopus matches: ${scopusMatches} (${((scopusMatches / entries.length) * 100).toFixed(1)}%)`);
  }
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
