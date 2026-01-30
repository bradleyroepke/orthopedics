"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Home,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, formatSubspecialty, slugifySubspecialty } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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

export function Sidebar() {
  const [subspecialties, setSubspecialties] = useState<SubspecialtyData[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

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
      }
    }
    fetchSubspecialties();
  }, []);

  const activeSubspecialties = subspecialties.filter((s) => s.count > 0);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-background transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Bone className="h-5 w-5 text-primary" />
            <span>Roepke Notes</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <div className="space-y-1">
          <NavItem
            href="/"
            icon={Home}
            label="All Documents"
            count={totalDocuments}
            isActive={pathname === "/"}
            collapsed={collapsed}
          />

          {!collapsed && (
            <>
              <Separator className="my-4" />
              <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Subspecialties
              </p>
            </>
          )}

          {activeSubspecialties.map((sub) => {
            const Icon = SUBSPECIALTY_ICONS[sub.name] || Folder;
            const href = `/subspecialty/${slugifySubspecialty(sub.name)}`;
            const isActive = pathname === href;

            return (
              <NavItem
                key={sub.name}
                href={href}
                icon={Icon}
                label={formatSubspecialty(sub.name)}
                count={sub.count}
                isActive={isActive}
                collapsed={collapsed}
              />
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  count?: number;
  isActive: boolean;
  collapsed: boolean;
}

function NavItem({
  href,
  icon: Icon,
  label,
  count,
  isActive,
  collapsed,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {count !== undefined && count > 0 && (
            <span
              className={cn(
                "text-xs",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
