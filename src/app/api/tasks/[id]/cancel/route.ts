import { cancelQueuedTask } from '@/lib/server/tasks';
import { ensureSession } from '@/lib/server/session';
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
} from '@/lib/server/http';
import { consumeRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = ensureSession(request);
  try {
    assertSameOrigin(request);
    consumeRateLimit(`cancel:${session.sessionId}`, 10, 60_000);
    const { id } = await context.params;
    const task = cancelQueuedTask(id, session.sessionId);
    return jsonResponse({ task }, { session });
  } catch (error) {
    return errorResponse(error, session);
  }
}
