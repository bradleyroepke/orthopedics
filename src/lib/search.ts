import Fuse from "fuse.js";
import { Document } from "@prisma/client";

const fuseOptions: Fuse.IFuseOptions<Document> = {
  keys: [
    { name: "title", weight: 0.4 },
    { name: "author", weight: 0.3 },
    { name: "journal", weight: 0.2 },
    { name: "filename", weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
};

export function createSearchIndex(documents: Document[]): Fuse<Document> {
  return new Fuse(documents, fuseOptions);
}

export function searchDocuments(
  fuse: Fuse<Document>,
  query: string,
  limit: number = 50
): Document[] {
  if (!query.trim()) {
    return [];
  }
  const results = fuse.search(query, { limit });
  return results.map((result) => result.item);
}

export type { Document };
