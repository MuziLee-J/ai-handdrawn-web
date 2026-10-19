import { getTaskForSession, toTaskDto } from '@/lib/server/tasks';
import { readSessionId } from '@/lib/server/session';
import { errorResponse, jsonResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionId = readSessionId(request);
  try {
    if (!sessionId) {
      return jsonResponse(
        { error: { code: 'UNAUTHORIZED', message: '会话不存在。', retryable: false } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const { id } = await context.params;
    const task = getTaskForSession(id, sessionId);
    return jsonResponse(
      { task: toTaskDto(task) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
