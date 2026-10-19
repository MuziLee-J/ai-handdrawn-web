import { z } from 'zod';
import { createWork, listWorks } from '@/lib/server/works';
import { AppError } from '@/lib/server/errors';
import { ensureSession } from '@/lib/server/session';
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '@/lib/server/http';
import { consumeRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createWorkSchema = z.object({
  title: z.string(),
  doc: z.unknown(),
  sourceAssetId: z.string().min(8).max(80).nullable().optional(),
  resultAssetId: z.string().min(8).max(80).nullable().optional(),
  styleId: z.string().max(40).nullable().optional(),
  templateId: z.string().max(40).nullable().optional(),
});

export async function GET(request: Request) {
  const session = ensureSession(request);
  try {
    return jsonResponse(
      { works: listWorks(session.sessionId) },
      { session, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, session);
  }
}

export async function POST(request: Request) {
  const session = ensureSession(request);
  try {
    assertSameOrigin(request);
    consumeRateLimit(`works-write:${session.sessionId}`, 60, 60_000);
    const body = createWorkSchema.parse(await readJsonBody(request));
    if (body.doc === undefined) {
      throw new AppError('BAD_REQUEST', '缺少排版文档。');
    }
    const work = createWork(session.sessionId, { ...body, doc: body.doc });
    return jsonResponse({ work }, { status: 201, session });
  } catch (error) {
    return errorResponse(error, session);
  }
}
