import { PrismaClient } from "@prisma/client";
import { readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const prisma = new PrismaClient();

interface RenameRecord {
  currentFilename: string;
  currentPath: string;
  subspecialty: string;
  extractedAuthor: string | null;
  extractedYear: string | null;
  extractedJournal: string | null;
  extractedTitle: string | null;
  suggestedFilename: string;
  confidence: string;
  confidenceLevel: string;
  status: string;
}

interface RollbackEntry {
  oldPath: string;
  newPath: string;
  oldFilename: string;
  newFilename: string;
  documentId: string | null;
}

// Parse CSV file
function parseCSV(content: string): RenameRecord[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: RenameRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j];
    }

    records.push({
      currentFilename: record["current_filename"] || "",
      currentPath: record["current_path"] || "",
      subspecialty: record["subspecialty"] || "",
      extractedAuthor: record["extracted_author"] || null,
      extractedYear: record["extracted_year"] || null,
      extractedJournal: record["extracted_journal"] || null,
      extractedTitle: record["extracted_title"] || null,
      suggestedFilename: record["suggested_filename"] || "",
      confidence: record["confidence"] || "0",
      confidenceLevel: record["confidence_level"] || "low",
      status: record["status"] || "pending",
    });
  }

  return records;
}

// Parse a single CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
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
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// Generate unique filename if duplicate exists
function getUniqueFilename(basePath: string, filename: string): string {
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);

  let counter = 1;
  let candidatePath = path.join(basePath, filename);

  while (existsSync(candidatePath)) {
    const newFilename = `${nameWithoutExt}_${counter}${ext}`;
    candidatePath = path.join(basePath, newFilename);
    counter++;
  }

  return path.basename(candidatePath);
}

async function main() {
  const articlesPath =
    process.env.ARTICLES_PATH ||
    "C:\\Users\\bradleyroepke\\ortho-library\\Articles";

  // Parse command line arguments
  const args = process.argv.slice(2);
  let inputFile: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      inputFile = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!inputFile) {
    console.error("Error: --input <csv-file> is required");
    console.log("Usage: npm run rename:apply -- --input review.csv [--dry-run]");
    process.exit(1);
  }

  // Read and parse CSV
  const csvContent = await readFile(inputFile, "utf-8");
  const records = parseCSV(csvContent);

  // Filter to approved records only
  const approved = records.filter((r) => r.status.toLowerCase() === "approved");

  console.log(`Found ${records.length} total records`);
  console.log(`Approved for renaming: ${approved.length}`);
  console.log(`Dry run mode: ${dryRun ? "YES (no changes will be made)" : "NO"}`);
  console.log("");

  if (approved.length === 0) {
    console.log("No records approved for renaming. Exiting.");
    process.exit(0);
  }

  const rollback: RollbackEntry[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const record of approved) {
    // Reconstruct full paths
    // The currentPath from CSV might be just the filename or a relative path
    let oldFullPath: string;
    if (record.currentPath && record.currentPath.includes(path.sep)) {
      oldFullPath = path.join(articlesPath, record.currentPath);
    } else {
      // Need to find the file in the database
      const doc = await prisma.document.findFirst({
        where: { filename: record.currentFilename },
      });
      if (doc) {
        oldFullPath = path.join(articlesPath, doc.filePath);
      } else {
        console.log(`⚠ Skipping "${record.currentFilename}" - not found in database`);
        skippedCount++;
        continue;
      }
    }

    // Check if source file exists
    if (!existsSync(oldFullPath)) {
      console.log(`⚠ Skipping "${record.currentFilename}" - file not found`);
      skippedCount++;
      continue;
    }

    const dirPath = path.dirname(oldFullPath);
    // Add .pdf extension if not present
    let suggestedName = record.suggestedFilename;
    if (!suggestedName.toLowerCase().endsWith(".pdf")) {
      suggestedName = suggestedName + ".pdf";
    }
    const newFilename = getUniqueFilename(dirPath, suggestedName);
    const newFullPath = path.join(dirPath, newFilename);

    // Find document in database
    const document = await prisma.document.findFirst({
      where: { filename: record.currentFilename },
    });

    if (dryRun) {
      console.log(`[DRY RUN] Would rename:`);
      console.log(`  From: ${record.currentFilename}`);
      console.log(`  To:   ${newFilename}`);
      if (document) {
        console.log(`  DB ID: ${document.id}`);
      }
      console.log("");
      successCount++;
      continue;
    }

    try {
      // Rename the physical file
      await rename(oldFullPath, newFullPath);

      // Update the database
      if (document) {
        const newRelativePath = path.relative(articlesPath, newFullPath);

        await prisma.document.update({
          where: { id: document.id },
          data: {
            filename: newFilename,
            filePath: newRelativePath,
            author: record.extractedAuthor || document.author,
            year: record.extractedYear ? parseInt(record.extractedYear) : document.year,
            journal: record.extractedJournal || document.journal,
            title: record.extractedTitle || document.title,
          },
        });
      }

      // Record for rollback
      rollback.push({
        oldPath: oldFullPath,
        newPath: newFullPath,
        oldFilename: record.currentFilename,
        newFilename: newFilename,
        documentId: document?.id || null,
      });

      console.log(`✓ Renamed: ${record.currentFilename}`);
      console.log(`      To: ${newFilename}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error renaming "${record.currentFilename}":`, error);
      errorCount++;
    }
  }

  // Save rollback manifest
  if (!dryRun && rollback.length > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rollbackPath = path.join(process.cwd(), `rollback-${timestamp}.json`);
    await writeFile(rollbackPath, JSON.stringify(rollback, null, 2));
    console.log(`\nRollback manifest saved to: ${rollbackPath}`);
  }

  // Summary
  console.log("\n=== Rename Complete ===");
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped: ${skippedCount}`);

  if (!dryRun && successCount > 0) {
    console.log("\nNote: You may want to re-run the indexer to verify integrity:");
    console.log("  npm run index");
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
