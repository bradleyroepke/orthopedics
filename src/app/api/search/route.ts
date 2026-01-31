import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createSearchIndex, searchDocuments } from '@/lib/search';

let searchIndex: ReturnType<typeof createSearchIndex> | null = null;
let indexedAt: number = 0;
const INDEX_TTL = 5 * 60 * 1000; // 5 minutes

async function getSearchIndex() {
  const now = Date.now();
  if (!searchIndex || now - indexedAt > INDEX_TTL) {
    const documents = await prisma.document.findMany();
    searchIndex = createSearchIndex(documents);
    indexedAt = now;
  }
  return searchIndex;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const fuse = await getSearchIndex();
  const results = searchDocuments(fuse, query, limit);

  return NextResponse.json({ results });
}
