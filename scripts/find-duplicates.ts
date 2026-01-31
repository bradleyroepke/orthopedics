import { readFileSync, writeFileSync, statSync, unlinkSync } from "fs";
import path from "path";
import crypto from "crypto";

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
  status: string;
  pdfTextPreview: string;
}

interface DuplicateGroup {
  key: string;
  type: "exact_filename" | "suggested_filename" | "content_hash";
  files: {
    path: string;
    fullPath: string;
    size: number;
    keep: boolean;
    reason: string;
  }[];
}

const ARTICLES_PATH = process.env.ARTICLES_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

// Subspecialty priority - prefer keeping files in specialty-specific folders
const SUBSPECIALTY_PRIORITY: Record<string, number> = {
  "TRAUMA": 1,
  "HAND": 2,
  "FOOT_AND_ANKLE": 3,
  "SHOULDER_AND_ELBOW": 4,
  "HIP_AND_KNEE": 5,
  "SPINE": 6,
  "SPORTS_MEDICINE": 7,
  "PEDIATRICS": 8,
  "ONCOLOGY": 9,
  "GENERAL": 10, // Prefer specialty folders over General
};

function getFileHash(filePath: string): string {
  try {
    const buffer = readFileSync(filePath);
    return crypto.createHash("md5").update(buffer).digest("hex");
  } catch {
    return "";
  }
}

function getFileSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function chooseBestFile(files: { path: string; subspecialty: string; size: number }[]): number {
  // Sort by: 1) Non-General subspecialty, 2) Subspecialty priority, 3) Larger file size
  const sorted = files
    .map((f, i) => ({ ...f, index: i }))
    .sort((a, b) => {
      const prioA = SUBSPECIALTY_PRIORITY[a.subspecialty] || 99;
      const prioB = SUBSPECIALTY_PRIORITY[b.subspecialty] || 99;

      if (prioA !== prioB) return prioA - prioB;
      return b.size - a.size; // Larger file preferred
    });

  return sorted[0].index;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--delete");
  const checkContent = args.includes("--check-content");

  console.log("=== Duplicate Finder ===");
  console.log(`Mode: ${dryRun ? "DRY RUN (use --delete to actually remove)" : "DELETE MODE"}`);
  console.log(`Content hash check: ${checkContent ? "ENABLED" : "DISABLED (use --check-content to enable)"}\n`);

  // Load rename review data
  const reviewPath = path.join(process.cwd(), "rename-review-2026-01-31.json");
  const data: RenameEntry[] = JSON.parse(readFileSync(reviewPath, "utf-8"));

  const duplicateGroups: DuplicateGroup[] = [];

  // 1. Find exact filename duplicates
  const byFilename: Record<string, RenameEntry[]> = {};
  for (const entry of data) {
    const key = entry.currentFilename.toLowerCase();
    if (!byFilename[key]) byFilename[key] = [];
    byFilename[key].push(entry);
  }

  for (const [filename, entries] of Object.entries(byFilename)) {
    if (entries.length > 1) {
      const files = entries.map(e => ({
        path: e.currentPath,
        fullPath: path.join(ARTICLES_PATH, e.currentPath),
        subspecialty: e.subspecialty,
        size: getFileSize(path.join(ARTICLES_PATH, e.currentPath)),
        keep: false,
        reason: "",
      }));

      const bestIdx = chooseBestFile(files.map(f => ({
        path: f.path,
        subspecialty: f.subspecialty,
        size: f.size
      })));

      files.forEach((f, i) => {
        f.keep = i === bestIdx;
        f.reason = i === bestIdx ? "Best location" : "Duplicate";
      });

      duplicateGroups.push({
        key: filename,
        type: "exact_filename",
        files,
      });
    }
  }

  // 2. Find suggested filename duplicates (different source files, same article)
  const bySuggested: Record<string, RenameEntry[]> = {};
  for (const entry of data) {
    // Skip files already identified as exact duplicates
    const isExactDupe = duplicateGroups.some(g =>
      g.type === "exact_filename" &&
      g.files.some(f => f.path === entry.currentPath && !f.keep)
    );
    if (isExactDupe) continue;

    const key = entry.suggestedFilename.toLowerCase();
    if (!bySuggested[key]) bySuggested[key] = [];
    bySuggested[key].push(entry);
  }

  for (const [suggested, entries] of Object.entries(bySuggested)) {
    if (entries.length > 1) {
      const files = entries.map(e => ({
        path: e.currentPath,
        fullPath: path.join(ARTICLES_PATH, e.currentPath),
        subspecialty: e.subspecialty,
        size: getFileSize(path.join(ARTICLES_PATH, e.currentPath)),
        keep: false,
        reason: "",
      }));

      // For suggested duplicates, also check file size similarity
      const sizes = files.map(f => f.size).filter(s => s > 0);
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      const sizeVariance = sizes.some(s => Math.abs(s - avgSize) / avgSize > 0.1);

      if (sizeVariance) {
        // Files are significantly different sizes - might not be true duplicates
        continue;
      }

      const bestIdx = chooseBestFile(files.map(f => ({
        path: f.path,
        subspecialty: f.subspecialty,
        size: f.size
      })));

      files.forEach((f, i) => {
        f.keep = i === bestIdx;
        f.reason = i === bestIdx ? "Best location" : "Same article (different filename)";
      });

      duplicateGroups.push({
        key: suggested,
        type: "suggested_filename",
        files,
      });
    }
  }

  // 3. Optional: Check content hashes for remaining files
  if (checkContent) {
    console.log("Checking content hashes (this may take a while)...");
    const remaining = data.filter(e =>
      !duplicateGroups.some(g => g.files.some(f => f.path === e.currentPath))
    );

    const byHash: Record<string, RenameEntry[]> = {};
    let checked = 0;

    for (const entry of remaining) {
      checked++;
      if (checked % 100 === 0) {
        console.log(`  Checked ${checked}/${remaining.length}...`);
      }

      const fullPath = path.join(ARTICLES_PATH, entry.currentPath);
      const hash = getFileHash(fullPath);
      if (!hash) continue;

      if (!byHash[hash]) byHash[hash] = [];
      byHash[hash].push(entry);
    }

    for (const [hash, entries] of Object.entries(byHash)) {
      if (entries.length > 1) {
        const files = entries.map(e => ({
          path: e.currentPath,
          fullPath: path.join(ARTICLES_PATH, e.currentPath),
          subspecialty: e.subspecialty,
          size: getFileSize(path.join(ARTICLES_PATH, e.currentPath)),
          keep: false,
          reason: "",
        }));

        const bestIdx = chooseBestFile(files.map(f => ({
          path: f.path,
          subspecialty: f.subspecialty,
          size: f.size
        })));

        files.forEach((f, i) => {
          f.keep = i === bestIdx;
          f.reason = i === bestIdx ? "Best location" : "Identical content";
        });

        duplicateGroups.push({
          key: hash.slice(0, 8),
          type: "content_hash",
          files,
        });
      }
    }
  }

  // Summary
  const toDelete = duplicateGroups.flatMap(g => g.files.filter(f => !f.keep));

  console.log("\n=== Summary ===");
  console.log(`Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`  - Exact filename matches: ${duplicateGroups.filter(g => g.type === "exact_filename").length}`);
  console.log(`  - Same article (diff filename): ${duplicateGroups.filter(g => g.type === "suggested_filename").length}`);
  console.log(`  - Identical content: ${duplicateGroups.filter(g => g.type === "content_hash").length}`);
  console.log(`\nFiles to remove: ${toDelete.length}`);
  console.log(`Files to keep: ${data.length - toDelete.length}`);

  // Write report
  const reportPath = path.join(process.cwd(), "duplicate-report.json");
  writeFileSync(reportPath, JSON.stringify(duplicateGroups, null, 2));
  console.log(`\nReport written to: ${reportPath}`);

  // List files to delete
  console.log("\n=== Files to Remove ===");
  for (const group of duplicateGroups) {
    console.log(`\n[${group.type}] ${group.key}:`);
    for (const file of group.files) {
      const status = file.keep ? "KEEP" : "DELETE";
      console.log(`  ${status}: ${file.path}`);
    }
  }

  // Actually delete if not dry run
  if (!dryRun) {
    console.log("\n=== Deleting Files ===");
    let deleted = 0;
    let errors = 0;

    for (const file of toDelete) {
      try {
        unlinkSync(file.fullPath);
        console.log(`Deleted: ${file.path}`);
        deleted++;
      } catch (err) {
        console.error(`Error deleting ${file.path}: ${err}`);
        errors++;
      }
    }

    console.log(`\nDeleted: ${deleted} files`);
    if (errors > 0) console.log(`Errors: ${errors}`);
  } else {
    console.log("\n[DRY RUN] No files were deleted. Use --delete to remove duplicates.");
  }
}

main().catch(console.error);
