"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  GraduationCap,
} from "lucide-react";
import { cn, formatSubspecialty, slugifySubspecialty } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

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

  // Separate library items from subspecialties
  const libraryCategories = ["TEXTBOOKS", "PRESENTATIONS"];
  const hiddenCategories = ["RESEARCH"];
  const libraryItems = subspecialties.filter(
    (s) => libraryCategories.includes(s.name) && s.count > 0
  );
  const activeSubspecialties = subspecialties.filter(
    (s) => !libraryCategories.includes(s.name) && !hiddenCategories.includes(s.name) && s.count > 0
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-card shadow-sm transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn(
        "relative border-b border-primary/20 bg-gradient-to-b from-card to-accent/30",
        collapsed ? "py-4" : "py-6"
      )}>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        {!collapsed ? (
          <Link
            href="/"
            className="group flex flex-col items-center gap-3 px-4"
          >
            <Image
              src="/images/logo.jpg"
              alt="Oklahoma Orthopedics"
              width={210}
              height={210}
              className="rounded-lg shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl"
            />
          </Link>
        ) : (
          <Link href="/" className="flex justify-center px-2">
            <Image
              src="/images/logo.jpg"
              alt="Oklahoma Orthopedics"
              width={40}
              height={40}
              className="rounded shadow-md"
            />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute right-2 top-2 h-7 w-7 opacity-60 hover:opacity-100 transition-opacity",
          )}
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
            label="All Files"
            count={totalDocuments}
            isActive={pathname === "/"}
            collapsed={collapsed}
          />

          <NavItem
            href="/resources"
            icon={GraduationCap}
            label="Learning Resources"
            isActive={pathname === "/resources"}
            collapsed={collapsed}
          />

          {libraryItems.map((item) => {
            const Icon = SUBSPECIALTY_ICONS[item.name] || Folder;
            const href = `/subspecialty/${slugifySubspecialty(item.name)}`;
            const isActive = pathname === href;

            return (
              <NavItem
                key={item.name}
                href={href}
                icon={Icon}
                label={formatSubspecialty(item.name)}
                count={item.count}
                isActive={isActive}
                collapsed={collapsed}
              />
            );
          })}

          {!collapsed && activeSubspecialties.length > 0 && (
            <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subspecialties
            </div>
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
