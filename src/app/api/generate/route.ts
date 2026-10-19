import { z } from 'zod';
import { getConfig } from '@/lib/server/config';
import { createGenerationTask } from '@/lib/server/tasks';
import { enqueueTask } from '@/lib/server/task-runner';
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
export const maxDuration = 300;

const generateSchema = z.object({
  sourceAssetId: z.string().min(8).max(80),
  styleId: z.enum(['watercolor', 'colored-pencil', 'pen-sketch']),
  fidelity: z.enum(['faithful', 'balanced', 'artistic']).default('balanced'),
  composition: z.enum(['full', 'sketchbook']).default('full'),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,128}$/),
});

export async function POST(request: Request) {
  const session = ensureSession(request);
  try {
    assertSameOrigin(request);
    consumeRateLimit(
      `generate:${session.sessionId}`,
      getConfig().generateRateLimitPerMinute,
      60_000,
    );
    const body = generateSchema.parse(await readJsonBody(request));
    const { task, created } = createGenerationTask(session.sessionId, body);
    if (created) {
      enqueueTask(task.id);
    }
    return jsonResponse(
      { task },
      { status: created ? 202 : 200, session },
    );
  } catch (error) {
    return errorResponse(error, session);
  }
}
