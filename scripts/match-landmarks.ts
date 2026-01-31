import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Normalize text for comparison
function normalize(text: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Simple word stemming
function stem(word: string): string {
  return word
    .replace(/(?:ing|ed|s|ly|tion|ment|ness)$/i, "")
    .replace(/(?:ies)$/i, "y");
}

// Get significant words from text
function getWords(text: string): Set<string> {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "through", "during", "before",
    "after", "above", "below", "between", "under", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "must", "shall", "can",
    "this", "that", "these", "those", "it", "its", "vs", "using", "based",
  ]);

  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .map(stem)
  );
}

// Calculate similarity between two texts
function textSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;

  const wordsA = getWords(a);
  const wordsB = getWords(b);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let matches = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matches++;
  }

  // Jaccard-like similarity
  const union = new Set([...wordsA, ...wordsB]).size;
  return matches / union;
}

// Calculate overall match confidence
function calculateMatchConfidence(
  landmark: { year: number; author: string; title: string; journal: string },
  doc: { year: number | null; author: string | null; title: string; journal: string | null }
): number {
  let score = 0;
  let weights = 0;

  // Title match (most important) - weight 0.5
  const titleSim = textSimilarity(landmark.title, doc.title);
  score += titleSim * 0.5;
  weights += 0.5;

  // Author match - weight 0.25
  if (landmark.author && doc.author) {
    const landmarkAuthor = normalize(landmark.author).split(" ")[0]; // First author last name
    const docAuthor = normalize(doc.author);
    if (docAuthor.includes(landmarkAuthor) || landmarkAuthor.includes(docAuthor)) {
      score += 0.25;
    } else {
      // Partial match
      const authorSim = textSimilarity(landmark.author, doc.author);
      score += authorSim * 0.25;
    }
  }
  weights += 0.25;

  // Year match - weight 0.15
  if (landmark.year && doc.year) {
    if (landmark.year === doc.year) {
      score += 0.15;
    } else if (Math.abs(landmark.year - doc.year) <= 1) {
      score += 0.1; // Off by one year is common
    }
  }
  weights += 0.15;

  // Journal match - weight 0.1
  if (landmark.journal && doc.journal) {
    const landmarkJournal = normalize(landmark.journal);
    const docJournal = normalize(doc.journal);
    if (landmarkJournal === docJournal ||
        landmarkJournal.includes(docJournal) ||
        docJournal.includes(landmarkJournal)) {
      score += 0.1;
    }
  }
  weights += 0.1;

  return score / weights;
}

interface MatchResult {
  landmarkId: string;
  landmarkTitle: string;
  documentId: string;
  documentTitle: string;
  confidence: number;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  const minConfidence = parseFloat(args.find(a => a.startsWith("--min-confidence="))?.split("=")[1] || "0.4");

  console.log("=== Landmark Article Matcher ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (use --apply to save matches)" : "APPLY MODE"}`);
  console.log(`Minimum confidence: ${minConfidence}\n`);

  // Fetch all landmarks without documents
  const landmarks = await prisma.landmarkArticle.findMany({
    where: { documentId: null },
  });

  // Fetch all documents
  const documents = await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      author: true,
      year: true,
      journal: true,
      filename: true,
      subspecialty: true,
    },
  });

  console.log(`Landmarks to match: ${landmarks.length}`);
  console.log(`Documents available: ${documents.length}\n`);

  const matches: MatchResult[] = [];
  const noMatches: string[] = [];
  let processed = 0;

  for (const landmark of landmarks) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`Processing ${processed}/${landmarks.length}...`);
    }

    let bestMatch: { docId: string; docTitle: string; confidence: number } | null = null;

    for (const doc of documents) {
      // Quick filter: subspecialty should match if both are set
      // (skip this check to allow cross-subspecialty matches)

      const confidence = calculateMatchConfidence(
        { year: landmark.year, author: landmark.author, title: landmark.title, journal: landmark.journal },
        { year: doc.year, author: doc.author, title: doc.title, journal: doc.journal }
      );

      if (confidence >= minConfidence) {
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { docId: doc.id, docTitle: doc.title, confidence };
        }
      }
    }

    if (bestMatch) {
      matches.push({
        landmarkId: landmark.id,
        landmarkTitle: landmark.title,
        documentId: bestMatch.docId,
        documentTitle: bestMatch.docTitle,
        confidence: bestMatch.confidence,
      });
    } else {
      noMatches.push(landmark.title);
    }
  }

  // Group matches by confidence level
  const highConfidence = matches.filter((m) => m.confidence >= 0.7);
  const mediumConfidence = matches.filter((m) => m.confidence >= 0.5 && m.confidence < 0.7);
  const lowConfidence = matches.filter((m) => m.confidence < 0.5);

  console.log("\n=== Results ===");
  console.log(`Total matches found: ${matches.length}`);
  console.log(`  High confidence (≥70%): ${highConfidence.length}`);
  console.log(`  Medium confidence (50-69%): ${mediumConfidence.length}`);
  console.log(`  Low confidence (<50%): ${lowConfidence.length}`);
  console.log(`No match found: ${noMatches.length}`);

  // Show sample matches
  console.log("\n=== Sample High Confidence Matches ===");
  highConfidence.slice(0, 10).forEach((m) => {
    console.log(`\n[${(m.confidence * 100).toFixed(0)}%] ${m.landmarkTitle.slice(0, 60)}`);
    console.log(`   → ${m.documentTitle.slice(0, 60)}`);
  });

  if (mediumConfidence.length > 0) {
    console.log("\n=== Sample Medium Confidence Matches ===");
    mediumConfidence.slice(0, 5).forEach((m) => {
      console.log(`\n[${(m.confidence * 100).toFixed(0)}%] ${m.landmarkTitle.slice(0, 60)}`);
      console.log(`   → ${m.documentTitle.slice(0, 60)}`);
    });
  }

  if (noMatches.length > 0 && noMatches.length <= 20) {
    console.log("\n=== Landmarks Without Matches ===");
    noMatches.forEach((title) => console.log(`  - ${title.slice(0, 70)}`));
  } else if (noMatches.length > 20) {
    console.log(`\n=== Landmarks Without Matches (showing first 20 of ${noMatches.length}) ===`);
    noMatches.slice(0, 20).forEach((title) => console.log(`  - ${title.slice(0, 70)}`));
  }

  // Apply matches if not dry run
  if (!dryRun && matches.length > 0) {
    console.log("\n=== Applying Matches ===");

    let updated = 0;
    for (const match of matches) {
      await prisma.landmarkArticle.update({
        where: { id: match.landmarkId },
        data: {
          documentId: match.documentId,
          matchConfidence: match.confidence,
        },
      });
      updated++;
    }

    console.log(`Updated ${updated} landmark articles with document links.`);
  } else if (dryRun) {
    console.log("\n[DRY RUN] No changes made. Use --apply to save matches.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
