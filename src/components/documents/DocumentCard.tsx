'use client';

import Link from 'next/link';
import {
  FileText,
  Calendar,
  User,
  BookOpen,
  BookMarked,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFileSize, formatSubspecialty } from '@/lib/utils';
import { Document } from '@prisma/client';

interface DocumentCardProps {
  document: Document;
  isLandmark?: boolean;
}

export function DocumentCard({ document, isLandmark }: DocumentCardProps) {
  const isTextbook = document.subspecialty === 'TEXTBOOKS';

  // Textbook-specific display
  if (isTextbook) {
    return (
      <Link href={`/documents/${document.id}`}>
        <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <BookMarked className="h-5 w-5 text-green-700" />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
                  {document.title}
                </h3>

                <p className="text-xs text-muted-foreground">
                  {document.author}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {document.journal && <span>{document.journal}</span>}
                  {document.year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {document.year}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700"
                  >
                    Textbook
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

  // Standard document display
  return (
    <Link href={`/documents/${document.id}`}>
      <Card
        className={`h-full transition-all hover:shadow-md hover:border-primary/50 ${isLandmark ? 'bg-gradient-to-br from-amber-500/5 to-orange-500/5 ring-1 ring-amber-500/20' : ''}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isLandmark ? 'bg-amber-500/10' : 'bg-primary/10'}`}
            >
              {isLandmark ? (
                <Star className="h-5 w-5 text-amber-600" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-medium text-sm leading-tight line-clamp-2">
                {document.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {document.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">
                      {document.author}
                    </span>
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
                    <span className="truncate max-w-[150px]">
                      {document.journal}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isLandmark && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700"
                  >
                    Landmark
                  </Badge>
                )}
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
