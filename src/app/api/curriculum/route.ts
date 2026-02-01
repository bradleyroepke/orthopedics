import { NextResponse } from "next/server";
import { parseCurriculumDocuments } from "@/lib/curriculum-parser";

const CURRICULUM_PATH =
  process.env.CURRICULUM_PATH ||
  "C:\\Users\\bradleyroepke\\ortho-library\\Curriculum";

export async function GET() {
  try {
    const documents = await parseCurriculumDocuments(CURRICULUM_PATH);

    // Calculate total entries
    const totalEntries = documents.reduce(
      (sum, doc) => sum + doc.entries.length,
      0
    );

    return NextResponse.json({
      documents,
      totalEntries,
    });
  } catch (error) {
    console.error("Failed to parse curriculum:", error);
    return NextResponse.json(
      { error: "Failed to load curriculum" },
      { status: 500 }
    );
  }
}
