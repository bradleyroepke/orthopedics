import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  User,
  BookOpen,
  FileText,
  HardDrive,
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { PDFViewer } from '@/components/documents/PDFViewer';
import { LandmarkToggle } from '@/components/documents/LandmarkToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatFileSize,
  formatSubspecialty,
  slugifySubspecialty,
} from '@/lib/utils';

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <Link
              href={`/subspecialty/${slugifySubspecialty(document.subspecialty)}`}
            >
              <Badge variant="secondary">
                {formatSubspecialty(document.subspecialty)}
              </Badge>
            </Link>
          </div>

          <h1 className="text-xl font-bold tracking-tight">{document.title}</h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {document.author && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {document.author}
              </span>
            )}
            {document.year && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {document.year}
              </span>
            )}
            {document.journal && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {document.journal}
              </span>
            )}
            <span className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" />
              {formatFileSize(document.fileSize)}
            </span>
          </div>
        </div>

        {/* Landmark Toggle */}
        <div className="flex-shrink-0">
          <LandmarkToggle documentId={document.id} />
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <PDFViewer documentId={document.id} filename={document.filename} />
      </div>
    </div>
  );
}
