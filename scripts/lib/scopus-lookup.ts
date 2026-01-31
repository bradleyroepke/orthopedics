// Scopus API utility for enhanced journal/article metadata lookup
// API Key: b9de371f79276fea9a0daa15a9242218

const SCOPUS_API_KEY = "b9de371f79276fea9a0daa15a9242218";
const SCOPUS_BASE_URL = "https://api.elsevier.com/content";

interface ScopusArticle {
  title: string;
  authors: string[];
  firstAuthor: string;
  year: number;
  journal: string;
  journalAbbrev: string;
  doi: string;
  issn: string;
}

interface ScopusSearchResult {
  found: boolean;
  article?: ScopusArticle;
  error?: string;
}

// Search for an article by title
export async function searchByTitle(title: string): Promise<ScopusSearchResult> {
  const query = encodeURIComponent(`TITLE("${title}")`);
  const url = `${SCOPUS_BASE_URL}/search/scopus?query=${query}&count=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-ELS-APIKey": SCOPUS_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { found: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const results = data["search-results"]?.entry;

    if (!results || results.length === 0 || results[0]["error"]) {
      return { found: false };
    }

    const entry = results[0];
    return {
      found: true,
      article: {
        title: entry["dc:title"] || "",
        authors: [],
        firstAuthor: extractFirstAuthor(entry["dc:creator"] || ""),
        year: parseInt(entry["prism:coverDate"]?.split("-")[0]) || 0,
        journal: entry["prism:publicationName"] || "",
        journalAbbrev: entry["prism:aggregationType"] || "",
        doi: entry["prism:doi"] || "",
        issn: entry["prism:issn"] || "",
      },
    };
  } catch (error) {
    return { found: false, error: String(error) };
  }
}

// Search for an article by DOI
export async function searchByDoi(doi: string): Promise<ScopusSearchResult> {
  const query = encodeURIComponent(`DOI("${doi}")`);
  const url = `${SCOPUS_BASE_URL}/search/scopus?query=${query}&count=1`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-ELS-APIKey": SCOPUS_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { found: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const results = data["search-results"]?.entry;

    if (!results || results.length === 0 || results[0]["error"]) {
      return { found: false };
    }

    const entry = results[0];
    return {
      found: true,
      article: {
        title: entry["dc:title"] || "",
        authors: [],
        firstAuthor: extractFirstAuthor(entry["dc:creator"] || ""),
        year: parseInt(entry["prism:coverDate"]?.split("-")[0]) || 0,
        journal: entry["prism:publicationName"] || "",
        journalAbbrev: "",
        doi: entry["prism:doi"] || "",
        issn: entry["prism:issn"] || "",
      },
    };
  } catch (error) {
    return { found: false, error: String(error) };
  }
}

// Search by author and year
export async function searchByAuthorYear(
  author: string,
  year: number
): Promise<ScopusSearchResult[]> {
  const query = encodeURIComponent(`AUTH("${author}") AND PUBYEAR IS ${year}`);
  const url = `${SCOPUS_BASE_URL}/search/scopus?query=${query}&count=10`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-ELS-APIKey": SCOPUS_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [{ found: false, error: `API error: ${response.status}` }];
    }

    const data = await response.json();
    const results = data["search-results"]?.entry;

    if (!results || results.length === 0 || results[0]["error"]) {
      return [{ found: false }];
    }

    return results.map((entry: Record<string, unknown>) => ({
      found: true,
      article: {
        title: entry["dc:title"] || "",
        authors: [],
        firstAuthor: extractFirstAuthor(String(entry["dc:creator"] || "")),
        year: parseInt(String(entry["prism:coverDate"])?.split("-")[0]) || 0,
        journal: entry["prism:publicationName"] || "",
        journalAbbrev: "",
        doi: entry["prism:doi"] || "",
        issn: entry["prism:issn"] || "",
      },
    }));
  } catch (error) {
    return [{ found: false, error: String(error) }];
  }
}

// Get journal info by ISSN
export async function getJournalByIssn(issn: string): Promise<{
  found: boolean;
  title?: string;
  abbreviation?: string;
  error?: string;
}> {
  const url = `${SCOPUS_BASE_URL}/serial/title/issn/${issn}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-ELS-APIKey": SCOPUS_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { found: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const entry = data["serial-metadata-response"]?.entry?.[0];

    if (!entry) {
      return { found: false };
    }

    return {
      found: true,
      title: entry["dc:title"],
      abbreviation: entry["prism:aggregationType"],
    };
  } catch (error) {
    return { found: false, error: String(error) };
  }
}

// Extract first author last name from creator string
function extractFirstAuthor(creator: string): string {
  if (!creator) return "";

  // Format is typically "LastName, FirstName" or "LastName F."
  const parts = creator.split(",");
  if (parts.length > 0) {
    return parts[0].trim();
  }
  return creator.split(" ")[0];
}

// Batch lookup for multiple files
export async function batchLookup(
  items: Array<{ title?: string; author?: string; year?: number; doi?: string }>
): Promise<ScopusSearchResult[]> {
  const results: ScopusSearchResult[] = [];

  for (const item of items) {
    // Try DOI first (most accurate)
    if (item.doi) {
      const result = await searchByDoi(item.doi);
      if (result.found) {
        results.push(result);
        continue;
      }
    }

    // Try title search
    if (item.title && item.title.length > 20) {
      const result = await searchByTitle(item.title);
      if (result.found) {
        results.push(result);
        continue;
      }
    }

    // Try author + year
    if (item.author && item.year) {
      const matches = await searchByAuthorYear(item.author, item.year);
      if (matches.length > 0 && matches[0].found) {
        results.push(matches[0]);
        continue;
      }
    }

    results.push({ found: false });
  }

  return results;
}
