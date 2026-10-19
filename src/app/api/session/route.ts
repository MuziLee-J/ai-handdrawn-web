import { getProviderInfo } from '@/lib/ai';
import { getConfig } from '@/lib/server/config';
import { getQuota } from '@/lib/server/quota';
import { ensureSession } from '@/lib/server/session';
import { jsonResponse, errorResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = ensureSession(request);
  try {
    let provider = null;
    try {
      provider = getProviderInfo();
    } catch {
      provider = null;
    }
    return jsonResponse(
      {
        session: { id: session.sessionId },
        quota: getQuota(session.sessionId),
        provider,
        aiConfigured: provider !== null,
        estimatedCostCents: getConfig().costCentsPerImage,
      },
      { session },
    );
  } catch (error) {
    return errorResponse(error, session);
  }
}
