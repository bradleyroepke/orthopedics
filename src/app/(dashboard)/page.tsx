"use client";

import { useState, useEffect } from "react";
import { SubspecialtyFolders } from "@/components/documents/SubspecialtyFolders";

export default function HomePage() {
  const [totalFiles, setTotalFiles] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTotal() {
      try {
        const res = await fetch("/api/subspecialties");
        if (res.ok) {
          const data = await res.json();
          setTotalFiles(data.totalDocuments);
        }
      } catch (error) {
        console.error("Failed to fetch total:", error);
      }
    }
    fetchTotal();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orthopedic Index</h1>
        <p className="text-muted-foreground">
          Browse files by subspecialty
        </p>
        {totalFiles !== null && (
          <p className="text-sm text-muted-foreground mt-1">
            {totalFiles.toLocaleString()} total files
          </p>
        )}
      </div>
      <SubspecialtyFolders />
    </div>
  );
}
