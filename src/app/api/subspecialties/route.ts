import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { VALID_SUBSPECIALTIES } from '@/lib/utils';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [docCounts, landmarkCounts] = await Promise.all([
    prisma.document.groupBy({
      by: ['subspecialty'],
      _count: {
        subspecialty: true,
      },
      orderBy: {
        subspecialty: 'asc',
      },
    }),
    prisma.landmarkArticle.groupBy({
      by: ['subspecialty'],
      where: { documentId: { not: null } },
      _count: {
        subspecialty: true,
      },
    }),
  ]);

  const subspecialties = VALID_SUBSPECIALTIES.map((sub) => {
    const docCount = docCounts.find((c) => c.subspecialty === sub);
    const landmarkCount = landmarkCounts.find((c) => c.subspecialty === sub);
    return {
      name: sub,
      count: docCount?._count.subspecialty || 0,
      landmarkCount: landmarkCount?._count.subspecialty || 0,
    };
  });

  const totalDocuments = docCounts.reduce(
    (sum, c) => sum + c._count.subspecialty,
    0
  );

  return NextResponse.json({
    subspecialties,
    totalDocuments,
  });
}
