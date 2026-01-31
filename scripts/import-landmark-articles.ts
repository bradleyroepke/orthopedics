import { PrismaClient } from "@prisma/client";
import { readdir } from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";
import Fuse from "fuse.js";

const prisma = new PrismaClient();

// Journal abbreviation mappings
const JOURNAL_ALIASES: Record<string, string[]> = {
  JBJS: ["jbjs", "journal of bone and joint surgery", "j bone joint surg"],
  AJSM: ["ajsm", "american journal of sports medicine", "am j sports med"],
  CORR: ["corr", "clinical orthopaedics", "clin orthop"],
  JHS: ["jhs", "journal of hand surgery", "j hand surg"],
  FAI: ["fai", "foot and ankle international", "foot ankle int"],
  Spine: ["spine"],
  Arthroscopy: ["arthroscopy", "arthrosc"],
  JAAOS: ["jaaos", "journal of the american academy", "j am acad orthop"],
  JOT: ["jot", "journal of orthopaedic trauma", "j orthop trauma"],
  BJJ: ["bjj", "bone joint journal", "bone joint j"],
  KSSTA: ["kssta", "knee surgery sports traumatology"],
  JPO: ["jpo", "journal of pediatric orthopaedics", "j pediatr orthop"],
  JSES: ["jses", "journal of shoulder and elbow surgery", "j shoulder elbow"],
};

// Map timeline file names to subspecialties
const FILE_SUBSPECIALTY_MAP: Record<string, string> = {
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

// Skip these files
const SKIP_FILES = ["MUSINGS.docx"];

interface LandmarkEntry {
  year: number;
  author: string;
  journal: string;
  title: string;
  description: string | null;
  subspecialty: string;
  displayOrder: number;
}

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
function parseTimelineEntries(
  paragraphs: string[],
  subspecialty: string
): LandmarkEntry[] {
  const entries: LandmarkEntry[] = [];
  let displayOrder = 0;

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
          subspecialty,
          displayOrder: displayOrder++,
        });
      }
    }
  }

  return entries;
}

// Normalize text for matching
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract key words from title (remove common words)
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "of", "in", "for", "and", "or", "to", "with", "by",
    "on", "at", "from", "as", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "its", "their", "our", "your", "this", "that", "these", "those",
  ]);

  return normalize(text)
    .split(" ")
    .filter(w => w.length > 2 && !stopWords.has(w));
}

// Check if journal matches (handles abbreviations)
function journalMatches(landmarkJournal: string, docText: string): boolean {
  const ljNorm = normalize(landmarkJournal);
  const dtNorm = normalize(docText);

  // Direct match
  if (dtNorm.includes(ljNorm)) return true;

  // Check aliases
  const aliases = JOURNAL_ALIASES[landmarkJournal] || [];
  for (const alias of aliases) {
    if (dtNorm.includes(alias)) return true;
  }

  // Check if any alias of landmark journal is in doc
  for (const [abbrev, aliasList] of Object.entries(JOURNAL_ALIASES)) {
    if (aliasList.some(a => ljNorm.includes(a) || a.includes(ljNorm))) {
      if (dtNorm.includes(normalize(abbrev)) || aliasList.some(a => dtNorm.includes(a))) {
        return true;
      }
    }
  }

  return false;
}

// Check if author matches (flexible matching)
function authorMatches(landmarkAuthor: string, docAuthor: string | null, docFilename: string): boolean {
  const authorLastName = normalize(landmarkAuthor.split(" ")[0].split(",")[0]);
  if (authorLastName.length < 3) return false;

  // Check in author field
  if (docAuthor && normalize(docAuthor).includes(authorLastName)) {
    return true;
  }

  // Check in filename
  if (normalize(docFilename).includes(authorLastName)) {
    return true;
  }

  return false;
}

// Cache all documents for faster matching
interface CachedDocument {
  id: string;
  filename: string;
  title: string;
  author: string | null;
  journal: string | null;
  year: number | null;
  searchText: string;
}

let documentCache: CachedDocument[] | null = null;
let fuseIndex: Fuse<CachedDocument> | null = null;

async function initDocumentCache() {
  if (documentCache) return;

  console.log("Loading document cache for matching...");
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      filename: true,
      title: true,
      author: true,
      journal: true,
      year: true,
    },
  });

  documentCache = docs.map(d => ({
    ...d,
    searchText: `${d.filename} ${d.title || ""} ${d.author || ""} ${d.journal || ""}`.toLowerCase(),
  }));

  // Create Fuse index for fuzzy searching
  fuseIndex = new Fuse(documentCache, {
    keys: ["filename", "title", "author"],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
  });

  console.log(`Cached ${documentCache.length} documents for matching\n`);
}

// Try to match a landmark article to an existing document
async function findMatchingDocument(
  entry: LandmarkEntry
): Promise<{ id: string; confidence: number } | null> {
  await initDocumentCache();
  if (!documentCache || !fuseIndex) return null;

  const titleKeywords = extractKeywords(entry.title);
  const authorLastName = normalize(entry.author.split(" ")[0].split(",")[0]);

  let bestMatch: { id: string; confidence: number } | null = null;

  // Strategy 1: Use Fuse.js fuzzy search on title
  const fuseResults = fuseIndex.search(entry.title, { limit: 20 });

  for (const result of fuseResults) {
    const doc = result.item;
    let score = 0;

    // Year match bonus (if years match exactly, big bonus)
    if (doc.year === entry.year) {
      score += 0.3;
    } else if (doc.year && Math.abs(doc.year - entry.year) <= 2) {
      score += 0.1; // Close year
    }

    // Author match
    if (authorMatches(entry.author, doc.author, doc.filename)) {
      score += 0.25;
    }

    // Journal match
    if (journalMatches(entry.journal, doc.searchText)) {
      score += 0.2;
    }

    // Title keyword overlap
    const docKeywords = extractKeywords(doc.searchText);
    const keywordMatches = titleKeywords.filter(k => docKeywords.includes(k)).length;
    const keywordScore = titleKeywords.length > 0
      ? (keywordMatches / titleKeywords.length) * 0.25
      : 0;
    score += keywordScore;

    // Fuse score bonus (lower is better in Fuse)
    const fuseScore = 1 - (result.score || 0.5);
    score += fuseScore * 0.2;

    if (score > 0.35 && (!bestMatch || score > bestMatch.confidence)) {
      bestMatch = { id: doc.id, confidence: score };
    }
  }

  // Strategy 2: Direct search for author + year combination
  if (!bestMatch || bestMatch.confidence < 0.6) {
    for (const doc of documentCache) {
      // Must have author match
      if (!authorMatches(entry.author, doc.author, doc.filename)) continue;

      let score = 0.25; // Author matched

      // Year match
      if (doc.year === entry.year) {
        score += 0.3;
      } else if (doc.year && Math.abs(doc.year - entry.year) <= 2) {
        score += 0.15;
      }

      // Journal match
      if (journalMatches(entry.journal, doc.searchText)) {
        score += 0.2;
      }

      // Keyword match
      const docKeywords = extractKeywords(doc.searchText);
      const keywordMatches = titleKeywords.filter(k => docKeywords.includes(k)).length;
      if (keywordMatches >= 2) {
        score += 0.25;
      } else if (keywordMatches >= 1) {
        score += 0.1;
      }

      if (score > 0.5 && (!bestMatch || score > bestMatch.confidence)) {
        bestMatch = { id: doc.id, confidence: score };
      }
    }
  }

  return bestMatch;
}

async function main() {
  const timelinePath =
    process.env.TIMELINE_PATH ||
    "C:\\Users\\bradleyroepke\\ortho-library\\Articles\\Timeline_of_influential_articles";

  console.log(`Reading timeline files from: ${timelinePath}`);

  const files = await readdir(timelinePath);
  const docxFiles = files.filter(
    (f) => f.endsWith(".docx") && !SKIP_FILES.includes(f)
  );

  console.log(`Found ${docxFiles.length} timeline files\n`);

  // Clear existing landmark articles
  const deleteCount = await prisma.landmarkArticle.deleteMany();
  console.log(`Cleared ${deleteCount.count} existing landmark articles\n`);

  let totalEntries = 0;
  let matchedEntries = 0;

  for (const file of docxFiles) {
    const subspecialty = FILE_SUBSPECIALTY_MAP[file];
    if (!subspecialty) {
      console.log(`⚠ Skipping ${file} - no subspecialty mapping`);
      continue;
    }

    console.log(`Processing: ${file} → ${subspecialty}`);

    const filePath = path.join(timelinePath, file);
    const paragraphs = await extractDocxText(filePath);
    const entries = parseTimelineEntries(paragraphs, subspecialty);

    console.log(`  Found ${entries.length} landmark articles`);

    for (const entry of entries) {
      const match = await findMatchingDocument(entry);

      await prisma.landmarkArticle.create({
        data: {
          year: entry.year,
          author: entry.author,
          journal: entry.journal,
          title: entry.title,
          description: entry.description,
          subspecialty: entry.subspecialty,
          displayOrder: entry.displayOrder,
          documentId: match?.id || null,
          matchConfidence: match?.confidence || null,
        },
      });

      totalEntries++;
      if (match) {
        matchedEntries++;
        if (match.confidence > 0.6) {
          console.log(
            `  ✓ Matched: "${entry.title.substring(0, 50)}..." (${Math.round(match.confidence * 100)}%)`
          );
        }
      }
    }
  }

  // Print summary
  console.log("\n=== Import Complete ===");
  console.log(`Total landmark articles: ${totalEntries}`);
  console.log(
    `Matched to documents: ${matchedEntries} (${Math.round((matchedEntries / totalEntries) * 100)}%)`
  );

  // Summary by subspecialty
  const summary = await prisma.landmarkArticle.groupBy({
    by: ["subspecialty"],
    _count: { subspecialty: true },
    orderBy: { subspecialty: "asc" },
  });

  console.log("\nBy subspecialty:");
  for (const item of summary) {
    console.log(`  ${item.subspecialty}: ${item._count.subspecialty}`);
  }

  // Show match rate by subspecialty
  const matched = await prisma.landmarkArticle.groupBy({
    by: ["subspecialty"],
    where: { documentId: { not: null } },
    _count: { subspecialty: true },
  });

  console.log("\nMatched by subspecialty:");
  for (const item of matched) {
    console.log(`  ${item.subspecialty}: ${item._count.subspecialty} matched`);
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
