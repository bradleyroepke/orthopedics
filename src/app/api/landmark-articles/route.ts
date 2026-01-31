import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const subspecialty = searchParams.get('subspecialty');

  const where = subspecialty ? { subspecialty } : {};

  const articles = await prisma.landmarkArticle.findMany({
    where,
    orderBy: [{ year: 'asc' }, { displayOrder: 'asc' }],
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

  // Get summary counts by subspecialty
  const summary = await prisma.landmarkArticle.groupBy({
    by: ['subspecialty'],
    _count: { subspecialty: true },
    orderBy: { subspecialty: 'asc' },
  });

  return NextResponse.json({
    articles,
    summary: summary.map((s) => ({
      subspecialty: s.subspecialty,
      count: s._count.subspecialty,
    })),
    total: articles.length,
  });
}
