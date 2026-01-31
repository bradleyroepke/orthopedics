'use client';

import { useState, useEffect } from 'react';
import { Document } from '@prisma/client';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentWithLandmark extends Document {
  isLandmark?: boolean;
}

export default function OITEPage() {
  const [documents, setDocuments] = useState<DocumentWithLandmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch('/api/documents?subspecialty=OITE&limit=200');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents);
          // Expand all years by default
          const years = new Set<string>();
          data.documents.forEach((doc: Document) => {
            const year = doc.year?.toString() || 'Unknown';
            years.add(year);
          });
          setExpandedYears(years);
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  // Group documents by year
  const groupedByYear = documents.reduce(
    (acc, doc) => {
      const year = doc.year?.toString() || 'Unknown';
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(doc);
      return acc;
    },
    {} as Record<string, DocumentWithLandmark[]>
  );

  // Sort years in descending order (most recent first), with "Unknown" at the end
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OITE</h1>
        <p className="text-muted-foreground">
          Orthopaedic In-Training Examination resources
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {documents.length} total files
        </p>
      </div>

      <div className="space-y-4">
        {sortedYears.map((year) => (
          <div key={year} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleYear(year)}
              className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{year}</span>
                <span className="text-sm text-muted-foreground">
                  ({groupedByYear[year].length}{' '}
                  {groupedByYear[year].length === 1 ? 'file' : 'files'})
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  expandedYears.has(year) && 'rotate-180'
                )}
              />
            </button>

            {expandedYears.has(year) && (
              <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupedByYear[year].map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    isLandmark={doc.isLandmark}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
