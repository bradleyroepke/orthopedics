import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const subspecialty = searchParams.get("subspecialty");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where = subspecialty ? { subspecialty } : {};

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ year: "desc" }, { author: "asc" }],
      skip,
      take: limit,
      include: {
        landmarkArticles: {
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.document.count({ where }),
  ]);

  // Add isLandmark flag to each document
  const documentsWithLandmark = documents.map((doc) => ({
    ...doc,
    isLandmark: doc.landmarkArticles.length > 0,
    landmarkArticles: undefined, // Remove the nested array
  }));

  return NextResponse.json({
    documents: documentsWithLandmark,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
