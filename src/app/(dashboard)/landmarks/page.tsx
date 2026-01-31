'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  FileText,
  ExternalLink,
  Star,
  BookOpen,
} from 'lucide-react';
import { cn, formatSubspecialty } from '@/lib/utils';

interface LandmarkArticle {
  id: string;
  year: number;
  author: string;
  journal: string;
  title: string;
  description: string | null;
  subspecialty: string;
  documentId: string | null;
  matchConfidence: number | null;
  document: {
    id: string;
    filename: string;
    filePath: string;
  } | null;
}

interface SubspecialtySummary {
  subspecialty: string;
  count: number;
}

function LandmarksPageLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

export default function LandmarksPage() {
  return (
    <Suspense fallback={<LandmarksPageLoading />}>
      <LandmarksPageContent />
    </Suspense>
  );
}

function LandmarksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [articles, setArticles] = useState<LandmarkArticle[]>([]);
  const [summary, setSummary] = useState<SubspecialtySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDecades, setExpandedDecades] = useState<Set<string>>(
    new Set()
  );

  // Read subspecialty from URL params
  const selectedSubspecialty = searchParams.get('subspecialty');

  const setSelectedSubspecialty = (subspecialty: string | null) => {
    if (subspecialty) {
      router.push(`/landmarks?subspecialty=${subspecialty}`);
    } else {
      router.push('/landmarks');
    }
  };

  useEffect(() => {
    async function fetchArticles() {
      try {
        const url = selectedSubspecialty
          ? `/api/landmark-articles?subspecialty=${selectedSubspecialty}`
          : '/api/landmark-articles';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles);
          setSummary(data.summary);

          // Expand all decades by default
          const decades = new Set<string>();
          data.articles.forEach((a: LandmarkArticle) => {
            decades.add(getDecade(a.year));
          });
          setExpandedDecades(decades);
        }
      } catch (error) {
        console.error('Failed to fetch landmark articles:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, [selectedSubspecialty]);

  const getDecade = (year: number): string => {
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
  };

  // Group articles by decade
  const groupedByDecade = articles.reduce(
    (acc, article) => {
      const decade = getDecade(article.year);
      if (!acc[decade]) {
        acc[decade] = [];
      }
      acc[decade].push(article);
      return acc;
    },
    {} as Record<string, LandmarkArticle[]>
  );

  // Sort decades chronologically
  const sortedDecades = Object.keys(groupedByDecade).sort((a, b) => {
    const aYear = parseInt(a);
    const bYear = parseInt(b);
    return aYear - bYear;
  });

  const toggleDecade = (decade: string) => {
    setExpandedDecades((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(decade)) {
        newSet.delete(decade);
      } else {
        newSet.add(decade);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const matchedCount = articles.filter((a) => a.documentId).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Star className="h-7 w-7 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight">
            Landmark Articles
          </h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Chronological timeline of influential orthopedic literature
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {articles.length} landmark articles
          {matchedCount > 0 && (
            <span className="text-primary">
              {' '}
              ({matchedCount} available in library)
            </span>
          )}
        </p>
      </div>

      {/* Subspecialty Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedSubspecialty === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedSubspecialty(null)}
        >
          All ({summary.reduce((sum, s) => sum + s.count, 0)})
        </Button>
        {summary.map((s) => (
          <Button
            key={s.subspecialty}
            variant={
              selectedSubspecialty === s.subspecialty ? 'default' : 'outline'
            }
            size="sm"
            onClick={() => setSelectedSubspecialty(s.subspecialty)}
          >
            {formatSubspecialty(s.subspecialty)} ({s.count})
          </Button>
        ))}
      </div>

      {/* Timeline View */}
      <div className="space-y-4">
        {sortedDecades.map((decade) => (
          <Card key={decade} className="overflow-hidden">
            <button
              onClick={() => toggleDecade(decade)}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-amber-700">
                  {decade}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({groupedByDecade[decade].length}{' '}
                  {groupedByDecade[decade].length === 1
                    ? 'article'
                    : 'articles'}
                  )
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  expandedDecades.has(decade) && 'rotate-180'
                )}
              />
            </button>

            {expandedDecades.has(decade) && (
              <CardContent className="p-0">
                <div className="divide-y">
                  {groupedByDecade[decade].map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      showSubspecialty={selectedSubspecialty === null}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ArticleRow({
  article,
  showSubspecialty,
}: {
  article: LandmarkArticle;
  showSubspecialty: boolean;
}) {
  const hasDocument = article.documentId && article.document;

  return (
    <div
      className={cn(
        'p-4 hover:bg-muted/50 transition-colors',
        hasDocument && 'bg-primary/5'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Year Badge */}
        <div className="flex-shrink-0 w-16 text-center">
          <span className="text-lg font-semibold text-primary">
            {article.year}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-medium text-sm leading-tight">
              {article.title}
            </h3>
            {hasDocument && (
              <Badge
                variant="outline"
                className="flex-shrink-0 text-[10px] bg-primary/10 text-primary border-primary/30"
              >
                <FileText className="h-3 w-3 mr-1" />
                Available
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="font-medium">{article.author}</span>
            <span>-</span>
            <span>{article.journal}</span>
          </div>

          {article.description && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {article.description}
            </p>
          )}

          {showSubspecialty && (
            <Badge variant="secondary" className="mt-2 text-[10px]">
              {formatSubspecialty(article.subspecialty)}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0">
          {hasDocument ? (
            <Link href={`/documents/${article.document!.id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                <BookOpen className="h-3 w-3" />
                View
              </Button>
            </Link>
          ) : (
            <Button variant="ghost" size="sm" disabled className="gap-1">
              <ExternalLink className="h-3 w-3" />
              Not in library
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
