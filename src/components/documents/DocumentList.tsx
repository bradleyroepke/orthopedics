"use client";

import { useState, useEffect } from "react";
import { Document } from "@prisma/client";
import { DocumentCard } from "./DocumentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Extended document type with landmark info
interface DocumentWithLandmark extends Document {
  isLandmark?: boolean;
}

interface DocumentListProps {
  subspecialty?: string;
  initialDocuments?: DocumentWithLandmark[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function DocumentList({ subspecialty, initialDocuments }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentWithLandmark[]>(initialDocuments || []);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(!initialDocuments);

  useEffect(() => {
    if (initialDocuments) return;

    async function fetchDocuments() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit),
        });
        if (subspecialty) {
          params.set("subspecialty", subspecialty);
        }

        const res = await fetch(`/api/documents?${params}`);
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [subspecialty, pagination.page, initialDocuments]);

  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          No documents found
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or search query
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} isLandmark={doc.isLandmark} />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
