'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface CurriculumEntry {
  year: number;
  author: string;
  journal: string;
  title: string;
  description: string | null;
  documentId?: string | null;
  filePath?: string | null;
}

interface CurriculumDocument {
  filename: string;
  displayName: string;
  entries: CurriculumEntry[];
}

export default function CurriculumPage() {
  const [documents, setDocuments] = useState<CurriculumDocument[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string>('');

  useEffect(() => {
    async function fetchCurriculum() {
      try {
        const res = await fetch('/api/curriculum');
        if (!res.ok) throw new Error('Failed to fetch curriculum');
        const data = await res.json();
        setDocuments(data.documents);
        setTotalEntries(data.totalEntries);
        setSource(data.source || 'unknown');
        if (data.documents.length > 0) {
          setActiveTopic(data.documents[0].displayName);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchCurriculum();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading curriculum...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const activeDocument = documents.find((d) => d.displayName === activeTopic);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Curriculum</h1>
        <p className="text-muted-foreground mt-1">
          Timeline of influential orthopedic articles ({totalEntries} articles across {documents.length} topics)
          {source === 'database' && (
            <Badge variant="outline" className="ml-2 text-xs">
              From Google Sheets
            </Badge>
          )}
        </p>
      </div>

      <ScrollArea className="w-full pb-2">
        <div className="flex gap-2 flex-wrap">
          {documents.map((doc) => (
            <Button
              key={doc.displayName}
              variant={activeTopic === doc.displayName ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTopic(doc.displayName)}
              className="gap-2"
            >
              {doc.displayName}
              <Badge
                variant={activeTopic === doc.displayName ? 'secondary' : 'outline'}
                className={cn(
                  'text-xs',
                  activeTopic === doc.displayName && 'bg-primary-foreground/20 text-primary-foreground'
                )}
              >
                {doc.entries.length}
              </Badge>
            </Button>
          ))}
        </div>
      </ScrollArea>

      {activeDocument && (
        <div className="space-y-4">
          {activeDocument.entries.map((entry, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {entry.year}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{entry.author}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{entry.journal}</span>
                    </div>
                  </div>
                  {entry.documentId && (
                    <Link href={`/documents/${entry.documentId}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-primary">
                        <FileText className="h-4 w-4" />
                        View PDF
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4">
                <CardTitle className="text-base font-medium leading-snug">
                  {entry.documentId ? (
                    <Link
                      href={`/documents/${entry.documentId}`}
                      className="hover:text-primary transition-colors"
                    >
                      {entry.title}
                    </Link>
                  ) : (
                    entry.title
                  )}
                </CardTitle>
                {entry.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {entry.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
