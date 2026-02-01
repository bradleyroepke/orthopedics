import { readFileSync } from "fs";

const csv = readFileSync("curriculum-import.csv", "utf-8");
const lines = csv.split("\n").slice(1).filter((l) => l.trim());

interface Entry {
  subspecialty: string;
  year: string;
  journal: string;
  author: string;
  title: string;
  description: string;
  pdfFilename: string;
}

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

const entries: Entry[] = [];
for (const line of lines) {
  const parts = parseCSVLine(line);
  if (parts.length >= 7) {
    entries.push({
      subspecialty: parts[0],
      year: parts[1],
      journal: parts[2],
      author: parts[3],
      title: parts[4],
      description: parts[5],
      pdfFilename: parts[6],
    });
  }
}

const unmatched = entries.filter((e) => !e.pdfFilename);
const matched = entries.filter((e) => e.pdfFilename);

// Find suspicious matches
interface Suspicious {
  entry: Entry;
  issue: string;
}

const suspicious: Suspicious[] = [];

for (const e of matched) {
  const fnYear = e.pdfFilename.match(/^(\d{4})/)?.[1];
  const fnParts = e.pdfFilename.split("_");
  const fnAuthor = (fnParts[1] || "").toLowerCase();
  const authorLast = e.author.toLowerCase().split(" ")[0].split(",")[0];

  // Year mismatch
  if (fnYear && fnYear !== e.year && Math.abs(parseInt(fnYear) - parseInt(e.year)) > 2) {
    suspicious.push({
      entry: e,
      issue: `Year mismatch: entry=${e.year}, file=${fnYear}`,
    });
  }
  // Author mismatch (if we can detect author in filename)
  else if (
    fnAuthor &&
    fnAuthor !== "unknown" &&
    authorLast.length >= 4 &&
    !fnAuthor.includes(authorLast.substring(0, 4))
  ) {
    suspicious.push({
      entry: e,
      issue: `Author mismatch: entry=${authorLast}, file=${fnAuthor}`,
    });
  }
}

// Summary by subspecialty
const bySubspec = new Map<string, { total: number; matched: number }>();
for (const e of entries) {
  const curr = bySubspec.get(e.subspecialty) || { total: 0, matched: 0 };
  curr.total++;
  if (e.pdfFilename) curr.matched++;
  bySubspec.set(e.subspecialty, curr);
}

console.log("=== MATCH SUMMARY BY SUBSPECIALTY ===\n");
for (const [sub, stats] of Array.from(bySubspec.entries()).sort()) {
  const pct = Math.round((stats.matched / stats.total) * 100);
  console.log(
    `${sub.padEnd(20)} ${stats.matched}/${stats.total} (${pct}%)`
  );
}

console.log(`\n\n=== UNMATCHED ENTRIES (${unmatched.length}) ===\n`);
const unmatchedBySubspec = new Map<string, Entry[]>();
for (const e of unmatched) {
  const list = unmatchedBySubspec.get(e.subspecialty) || [];
  list.push(e);
  unmatchedBySubspec.set(e.subspecialty, list);
}

for (const [sub, list] of Array.from(unmatchedBySubspec.entries()).sort()) {
  console.log(`\n--- ${sub} (${list.length} unmatched) ---`);
  for (const e of list.slice(0, 10)) {
    console.log(`  ${e.year} ${e.author.padEnd(15)} ${e.title.substring(0, 50)}`);
  }
  if (list.length > 10) {
    console.log(`  ... and ${list.length - 10} more`);
  }
}

console.log(`\n\n=== SUSPICIOUS MATCHES (${suspicious.length}) ===\n`);
for (const s of suspicious.slice(0, 30)) {
  console.log(`${s.entry.year} ${s.entry.author}`);
  console.log(`  Title: ${s.entry.title.substring(0, 60)}`);
  console.log(`  PDF: ${s.entry.pdfFilename}`);
  console.log(`  Issue: ${s.issue}\n`);
}
if (suspicious.length > 30) {
  console.log(`... and ${suspicious.length - 30} more suspicious matches`);
}
