"use client";

import Link from "next/link";
import { FileText, Calendar, User, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, formatSubspecialty } from "@/lib/utils";
import { Document } from "@prisma/client";

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
  return (
    <Link href={`/documents/${document.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-medium text-sm leading-tight line-clamp-2">
                {document.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {document.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{document.author}</span>
                  </span>
                )}
                {document.year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {document.year}
                  </span>
                )}
                {document.journal && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{document.journal}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {formatSubspecialty(document.subspecialty)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(document.fileSize)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
