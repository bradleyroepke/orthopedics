"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatSubspecialty, slugifySubspecialty } from "@/lib/utils";

interface SubspecialtyData {
  name: string;
  count: number;
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
  FOOT_AND_ANKLE: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  HAND: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
  HIP_AND_KNEE: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  SHOULDER_AND_ELBOW: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20",
  SPINE: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
  SPORTS_MEDICINE: "bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20",
  TRAUMA: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
  ONCOLOGY: "bg-pink-500/10 text-pink-600 hover:bg-pink-500/20",
  PEDIATRICS: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20",
  GENERAL: "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20",
  TEXTBOOKS: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
  PRESENTATIONS: "bg-violet-500/10 text-violet-600 hover:bg-violet-500/20",
  RESEARCH: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20",
};

// Define display order for subspecialties
const SUBSPECIALTY_ORDER = [
  "FOOT_AND_ANKLE",
  "HAND",
  "HIP_AND_KNEE",
  "SHOULDER_AND_ELBOW",
  "SPINE",
  "SPORTS_MEDICINE",
  "TRAUMA",
  "ONCOLOGY",
  "PEDIATRICS",
  "GENERAL",
  "TEXTBOOKS",
  "PRESENTATIONS",
  "RESEARCH",
];

export function SubspecialtyFolders() {
  const [subspecialties, setSubspecialties] = useState<SubspecialtyData[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubspecialties() {
      try {
        const res = await fetch("/api/subspecialties");
        if (res.ok) {
          const data = await res.json();
          setSubspecialties(data.subspecialties);
          setTotalDocuments(data.totalDocuments);
        }
      } catch (error) {
        console.error("Failed to fetch subspecialties:", error);
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
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalDocuments.toLocaleString()}</p>
              <p className="text-muted-foreground">Total Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folder Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {sortedSubspecialties.map((sub) => {
          const Icon = SUBSPECIALTY_ICONS[sub.name] || Folder;
          const colorClass = SUBSPECIALTY_COLORS[sub.name] || SUBSPECIALTY_COLORS.GENERAL;
          const href = `/subspecialty/${slugifySubspecialty(sub.name)}`;

          return (
            <Link key={sub.name} href={href}>
              <Card
                className={cn(
                  "h-full transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-primary/30 hover:shadow-md",
                  colorClass
                )}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="p-4 rounded-xl bg-background/50">
                      <Icon className="h-10 w-10" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {formatSubspecialty(sub.name)}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sub.count.toLocaleString()} {sub.count === 1 ? "document" : "documents"}
                      </p>
                    </div>
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
