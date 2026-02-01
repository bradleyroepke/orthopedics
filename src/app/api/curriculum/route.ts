import { NextResponse } from "next/server";
import { parseCurriculumDocuments } from "@/lib/curriculum-parser";
import prisma from "@/lib/prisma";

const CURRICULUM_PATH =
  process.env.CURRICULUM_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Curriculum";

// Map subspecialty codes to display names
const SUBSPECIALTY_DISPLAY_NAMES: Record<string, string> = {
  ANATOMY: "Anatomy",
  BASIC_SCIENCE: "Basic Science",
  FOOT_AND_ANKLE: "Foot & Ankle",
  GENERAL: "General",
  HAND: "Hand to Elbow",
  HIP_AND_KNEE: "Hip & Knee",
  ONCOLOGY: "MSK Oncology",
  PEDIATRICS: "Pediatrics",
  SHOULDER_AND_ELBOW: "Shoulder & Elbow",
  SPINE: "Spine",
  SPORTS_MEDICINE: "Sports Medicine",
  TRAUMA: "Trauma",
};

export async function GET() {
  try {
    // First, check if we have landmark articles in the database
    const dbCount = await prisma.landmarkArticle.count();

    if (dbCount > 0) {
      // Use database (populated via Google Sheets import)
      const articles = await prisma.landmarkArticle.findMany({
        orderBy: [{ subspecialty: "asc" }, { year: "asc" }, { displayOrder: "asc" }],
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              filePath: true,
            },
          },
        },
      });

      // Group by subspecialty
      const grouped = new Map<string, typeof articles>();
      for (const article of articles) {
        const existing = grouped.get(article.subspecialty) || [];
        existing.push(article);
        grouped.set(article.subspecialty, existing);
      }

      // Convert to response format
      const documents = Array.from(grouped.entries())
        .map(([subspecialty, entries]) => ({
          filename: subspecialty,
          displayName: SUBSPECIALTY_DISPLAY_NAMES[subspecialty] || subspecialty,
          entries: entries.map((e) => ({
            year: e.year,
            author: e.author,
            journal: e.journal,
            title: e.title,
            description: e.description,
            documentId: e.document?.id || null,
            filePath: e.document?.filePath || null,
          })),
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      return NextResponse.json({
        documents,
        totalEntries: dbCount,
        source: "database",
      });
    }

    // Fallback: Parse .docx files directly
    const documents = await parseCurriculumDocuments(CURRICULUM_PATH);
    const totalEntries = documents.reduce(
      (sum, doc) => sum + doc.entries.length,
      0
    );

    return NextResponse.json({
      documents,
      totalEntries,
      source: "docx",
    });
  } catch (error) {
    console.error("Failed to load curriculum:", error);
    return NextResponse.json(
      { error: "Failed to load curriculum" },
      { status: 500 }
    );
  }
}
