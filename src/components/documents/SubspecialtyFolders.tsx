'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Footprints,
  Hand,
  Activity,
  CircleDot,
  Bone,
  Dumbbell,
  AlertTriangle,
  Heart,
  Baby,
  Folder,
  BookOpen,
  Presentation,
  FlaskConical,
  FileText,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatSubspecialty, slugifySubspecialty } from '@/lib/utils';

interface SubspecialtyData {
  name: string;
  count: number;
  landmarkCount: number;
}

const SUBSPECIALTY_ICONS: Record<string, React.ElementType> = {
  FOOT_AND_ANKLE: Footprints,
  HAND: Hand,
  HIP_AND_KNEE: Activity,
  SHOULDER_AND_ELBOW: CircleDot,
  SPINE: Bone,
  SPORTS_MEDICINE: Dumbbell,
  TRAUMA: AlertTriangle,
  ONCOLOGY: Heart,
  PEDIATRICS: Baby,
  GENERAL: Folder,
  TEXTBOOKS: BookOpen,
  PRESENTATIONS: Presentation,
  RESEARCH: FlaskConical,
};

const SUBSPECIALTY_COLORS: Record<string, string> = {
  FOOT_AND_ANKLE: 'bg-sky-500/10 text-sky-700 hover:bg-sky-500/20',
  HAND: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20',
  HIP_AND_KNEE: 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20',
  SHOULDER_AND_ELBOW: 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/20',
  SPINE: 'bg-rose-500/10 text-rose-700 hover:bg-rose-500/20',
  SPORTS_MEDICINE: 'bg-teal-500/10 text-teal-700 hover:bg-teal-500/20',
  TRAUMA: 'bg-orange-500/10 text-orange-700 hover:bg-orange-500/20',
  ONCOLOGY: 'bg-pink-500/10 text-pink-700 hover:bg-pink-500/20',
  PEDIATRICS: 'bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20',
  GENERAL: 'bg-stone-500/10 text-stone-700 hover:bg-stone-500/20',
  TEXTBOOKS: 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
  PRESENTATIONS: 'bg-purple-500/10 text-purple-700 hover:bg-purple-500/20',
  RESEARCH: 'bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20',
};

// Define display order for subspecialties
const SUBSPECIALTY_ORDER = [
  'FOOT_AND_ANKLE',
  'HAND',
  'HIP_AND_KNEE',
  'SHOULDER_AND_ELBOW',
  'SPINE',
  'SPORTS_MEDICINE',
  'TRAUMA',
  'ONCOLOGY',
  'PEDIATRICS',
  'GENERAL',
  'TEXTBOOKS',
  'PRESENTATIONS',
  'RESEARCH',
];

export function SubspecialtyFolders() {
  const [subspecialties, setSubspecialties] = useState<SubspecialtyData[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubspecialties() {
      try {
        const res = await fetch('/api/subspecialties');
        if (res.ok) {
          const data = await res.json();
          setSubspecialties(data.subspecialties);
          setTotalDocuments(data.totalDocuments);
        }
      } catch (error) {
        console.error('Failed to fetch subspecialties:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubspecialties();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  // Sort subspecialties according to defined order
  const sortedSubspecialties = [...subspecialties]
    .filter((s) => s.count > 0)
    .sort((a, b) => {
      const indexA = SUBSPECIALTY_ORDER.indexOf(a.name);
      const indexB = SUBSPECIALTY_ORDER.indexOf(b.name);
      return indexA - indexB;
    });

  return (
    <div className="space-y-8">
      {/* Folder Grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {sortedSubspecialties.map((sub) => {
          const colorClass =
            SUBSPECIALTY_COLORS[sub.name] || SUBSPECIALTY_COLORS.GENERAL;
          const href = `/subspecialty/${slugifySubspecialty(sub.name)}`;

          return (
            <Link key={sub.name} href={href}>
              <Card
                className={cn(
                  'h-full transition-all duration-200 cursor-pointer border border-transparent hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5',
                  colorClass
                )}
              >
                <CardContent className="p-3">
                  <div className="text-center">
                    <h3 className="font-semibold text-sm text-foreground">
                      {formatSubspecialty(sub.name)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sub.count.toLocaleString()}{' '}
                      {sub.count === 1 ? 'doc' : 'docs'}
                    </p>
                    {sub.landmarkCount > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5 flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 fill-amber-500" />
                        {sub.landmarkCount} landmark
                        {sub.landmarkCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
