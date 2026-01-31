import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Construct full path
  const documentsPath = process.env.DOCUMENTS_PATH || '';
  const fullPath = path.join(documentsPath, document.filePath);

  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = await readFile(fullPath);
  const fileStat = await stat(fullPath);

  // Check for range request (for streaming)
  const range = request.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
    const chunkSize = end - start + 1;
    const chunk = fileBuffer.subarray(start, end + 1);

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'application/pdf',
      },
    });
  }

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(fileStat.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.filename)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
