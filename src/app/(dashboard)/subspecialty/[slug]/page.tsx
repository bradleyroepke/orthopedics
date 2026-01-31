import { notFound } from 'next/navigation';
import { DocumentList } from '@/components/documents/DocumentList';
import {
  formatSubspecialty,
  unslugifySubspecialty,
  VALID_SUBSPECIALTIES,
} from '@/lib/utils';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
        <p className="text-muted-foreground">
          Documents in the {displayName.toLowerCase()} subspecialty
        </p>
      </div>
      <DocumentList subspecialty={subspecialtyKey} />
    </div>
  );
}
