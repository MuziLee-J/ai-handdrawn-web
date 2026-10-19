import { NextResponse } from 'next/server';
import { getAssetRow, readAssetBuffer } from '@/lib/server/assets';
import { readSessionId } from '@/lib/server/session';
import { errorResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: '文件不存在。', retryable: false } },
      { status: 404 },
    );
  }

  try {
    const { id } = await context.params;
    const asset = getAssetRow(id, sessionId);
    const buffer = readAssetBuffer(asset);
    const extension = EXTENSIONS[asset.mime] ?? 'bin';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': asset.mime,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${asset.id}.${extension}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
