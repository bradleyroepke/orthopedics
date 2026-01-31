import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { DocumentList } from '@/components/documents/DocumentList';
import { Button } from '@/components/ui/button';
import {
  formatSubspecialty,
  unslugifySubspecialty,
  VALID_SUBSPECIALTIES,
} from '@/lib/utils';
import prisma from '@/lib/prisma';

interface SubspecialtyPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SubspecialtyPage({
  params,
}: SubspecialtyPageProps) {
  const { slug } = await params;
  const subspecialtyKey = unslugifySubspecialty(slug);

  // Validate that the subspecialty exists
  if (!VALID_SUBSPECIALTIES.includes(subspecialtyKey)) {
    notFound();
  }

  const displayName = formatSubspecialty(subspecialtyKey);

  // Get landmark count for this subspecialty
  const landmarkCount = await prisma.landmarkArticle.count({
    where: {
      subspecialty: subspecialtyKey,
      documentId: { not: null },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-muted-foreground">
            Documents in the {displayName.toLowerCase()} subspecialty
          </p>
        </div>
        {landmarkCount > 0 && (
          <Link href={`/landmarks?subspecialty=${subspecialtyKey}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              {landmarkCount} Landmark{landmarkCount === 1 ? '' : 's'}
            </Button>
          </Link>
        )}
      </div>
      <DocumentList subspecialty={subspecialtyKey} />
    </div>
  );
}
