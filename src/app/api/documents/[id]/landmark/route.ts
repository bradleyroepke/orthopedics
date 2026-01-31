import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Check if document is a landmark
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const landmark = await prisma.landmarkArticle.findFirst({
    where: { documentId: id },
  });

  return NextResponse.json({
    isLandmark: !!landmark,
    landmark: landmark || null,
  });
}

// POST: Add document as landmark
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Get the document
  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Check if already a landmark
  const existing = await prisma.landmarkArticle.findFirst({
    where: { documentId: id },
  });

  if (existing) {
    return NextResponse.json({
      message: 'Already a landmark',
      landmark: existing,
    });
  }

  // Parse optional body for description
  let description: string | null = null;
  try {
    const body = await request.json();
    description = body.description || null;
  } catch {
    // No body, that's fine
  }

  // Create landmark from document
  const landmark = await prisma.landmarkArticle.create({
    data: {
      year: document.year || new Date().getFullYear(),
      author: document.author || 'Unknown',
      journal: document.journal || 'Unknown',
      title: document.title,
      description,
      subspecialty: document.subspecialty,
      documentId: document.id,
      matchConfidence: 1.0, // Manual match = 100% confidence
    },
  });

  return NextResponse.json({
    message: 'Added as landmark',
    landmark,
  });
}

// DELETE: Remove landmark status
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Find and delete the landmark entry
  const landmark = await prisma.landmarkArticle.findFirst({
    where: { documentId: id },
  });

  if (!landmark) {
    return NextResponse.json({
      message: 'Not a landmark',
    });
  }

  await prisma.landmarkArticle.delete({
    where: { id: landmark.id },
  });

  return NextResponse.json({
    message: 'Removed from landmarks',
  });
}
