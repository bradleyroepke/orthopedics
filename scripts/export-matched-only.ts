import { readFileSync, writeFileSync } from "fs";

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

function cleanText(text: string): string {
  // Remove garbage patterns from docx parsing
  return text
    .replace(/0{10,}/g, "") // Remove long runs of zeros
    .replace(/\d{10,}/g, "") // Remove very long numbers
    .replace(/image\d+\.png/g, "") // Remove image references
    .replace(/http:\/\/schemas[^\s,]*/g, "") // Remove schema URLs
    .replace(/rId\d+/g, "") // Remove rId references
    .replace(/rect/g, "") // Remove rect
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

function escapeCSV(field: string): string {
  const clean = cleanText(field);
  if (clean.includes(",") || clean.includes('"') || clean.includes("\n")) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

const csv = readFileSync("curriculum-import-strict.csv", "utf-8");
const lines = csv.split("\n").filter((l) => l.trim());

const header = "Subspecialty,Year,Journal,Author,Title,Description,PDF_Filename";
const outputLines: string[] = [header];

let count = 0;
for (const line of lines.slice(1)) {
  const parts = parseCSVLine(line);
  if (parts.length >= 7 && parts[6]) {
    // Has PDF filename
    const [subspecialty, year, journal, author, title, description, pdfFilename] = parts;

    const cleanRow = [
      subspecialty,
      year,
      escapeCSV(journal),
      escapeCSV(author),
      escapeCSV(title),
      escapeCSV(description),
      escapeCSV(pdfFilename),
    ].join(",");

    outputLines.push(cleanRow);
    count++;
  }
}

writeFileSync("curriculum-matched-only.csv", outputLines.join("\n"), "utf-8");
console.log(`Exported ${count} matched entries to curriculum-matched-only.csv`);

// Also show them
console.log("\n=== Matched Entries ===\n");
for (const line of outputLines.slice(1)) {
  const parts = parseCSVLine(line);
  console.log(`${parts[0].padEnd(20)} ${parts[1]} ${parts[3].padEnd(15)} -> ${parts[6].substring(0, 50)}`);
}
