"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, LogOut, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Document } from "@prisma/client";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Header() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Document[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const router = useRouter();

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search]);

  const handleSelect = (doc: Document) => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    router.push(`/documents/${doc.id}`);
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search documents by title, author, journal..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="pl-10 pr-4"
        />

        {showResults && (query.trim() || results.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-auto rounded-md border bg-popover shadow-lg">
            {isSearching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <ul>
                {results.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(doc)}
                      className="w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                    >
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[doc.author, doc.year, doc.journal]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
