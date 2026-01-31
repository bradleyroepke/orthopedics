'use client';

import Link from 'next/link';
import {
  FileText,
  BookMarked,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/lib/utils';
import { Document } from '@prisma/client';

interface DocumentCardProps {
  document: Document;
  isLandmark?: boolean;
}

// Clean up title for display
function formatTitle(title: string): string {
  if (!title) return 'Untitled';

  let formatted = title;

  // Split CamelCase into words (e.g., "ManagementofChronicAchillesRupture" -> "Management of Chronic Achilles Rupture")
  formatted = formatted
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

  // Fix common stuck-together words
  formatted = formatted
    .replace(/(\w)(of|the|and|in|for|with|to)([A-Z])/gi, '$1 $2 $3')
    .replace(/(of|the|and|in|for|with|to)([A-Z])/gi, '$1 $2');

  // Remove common artifacts from filenames
  formatted = formatted
    .replace(/^(Unknown|Untitled)\s*/i, '')
    .replace(/\s*(Jbjs|Jaaos|Corr|Ajsm|Jot)\s*$/i, '') // Remove journal abbrevs at end
    .replace(/\s*\d{4}\s*$/, '') // Remove year at end if present
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter of each major word
  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted || 'Untitled';
}

// Format the metadata line (Author · Journal · Year)
function formatMetadataLine(doc: Document): string {
  const parts: string[] = [];

  if (doc.author && doc.author !== 'Unknown') {
    // Clean author - take just last name if it looks like a full name
    let author = doc.author;
    if (author.includes(' ')) {
      const nameParts = author.split(' ');
      author = nameParts[nameParts.length - 1]; // Take last part as last name
    }
    // Remove any non-name characters
    author = author.replace(/[^a-zA-Z\s-]/g, '').trim();
    if (author) parts.push(author);
  }

  if (doc.journal) {
    // Use abbreviation if it's a full name, otherwise use as-is
    let journal = doc.journal;
    const abbreviations: Record<string, string> = {
      'Journal of Bone and Joint Surgery': 'JBJS',
      'Journal of the American Academy of Orthopaedic Surgeons': 'JAAOS',
      'Clinical Orthopaedics and Related Research': 'CORR',
      'American Journal of Sports Medicine': 'AJSM',
      'Journal of Orthopaedic Trauma': 'JOT',
      'Journal of Hand Surgery': 'JHS',
      'Foot and Ankle International': 'FAI',
      'Journal of Pediatric Orthopaedics': 'JPO',
      'Journal of Shoulder and Elbow Surgery': 'JSES',
    };
    journal = abbreviations[journal] || journal;
    parts.push(journal);
  }

  if (doc.year) {
    parts.push(String(doc.year));
  }

  return parts.join(' · ');
}

export function DocumentCard({ document, isLandmark }: DocumentCardProps) {
  const isTextbook = document.subspecialty === 'TEXTBOOKS';

  // Textbook-specific display
  if (isTextbook) {
    const textbookMeta: string[] = [];
    if (document.author) textbookMeta.push(document.author);
    if (document.journal) textbookMeta.push(document.journal); // Edition stored in journal field
    if (document.year) textbookMeta.push(String(document.year));

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
                  {formatTitle(document.title)}
                </h3>

                {textbookMeta.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {textbookMeta.join(' · ')}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-0.5">
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
  const displayTitle = formatTitle(document.title);
  const metadataLine = formatMetadataLine(document);

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

            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="font-medium text-sm leading-tight line-clamp-2">
                {displayTitle}
              </h3>

              {metadataLine && (
                <p className="text-xs text-muted-foreground truncate">
                  {metadataLine}
                </p>
              )}

              <div className="flex items-center gap-2 pt-0.5">
                {isLandmark && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700"
                  >
                    Landmark
                  </Badge>
                )}
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
