import { z } from 'zod';
import { deleteWork, getWork, updateWork } from '@/lib/server/works';
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

const updateWorkSchema = z.object({
  title: z.string().optional(),
  doc: z.unknown().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = ensureSession(request);
  try {
    const { id } = await context.params;
    return jsonResponse(
      { work: getWork(id, session.sessionId) },
      { session, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, session);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = ensureSession(request);
  try {
    assertSameOrigin(request);
    consumeRateLimit(`works-write:${session.sessionId}`, 60, 60_000);
    const { id } = await context.params;
    const body = updateWorkSchema.parse(await readJsonBody(request));
    const work = updateWork(id, session.sessionId, body);
    return jsonResponse({ work }, { session });
  } catch (error) {
    return errorResponse(error, session);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = ensureSession(request);
  try {
    assertSameOrigin(request);
    consumeRateLimit(`works-write:${session.sessionId}`, 60, 60_000);
    const { id } = await context.params;
    deleteWork(id, session.sessionId);
    return jsonResponse({ ok: true }, { session });
  } catch (error) {
    return errorResponse(error, session);
  }
}
