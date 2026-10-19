import { NextResponse } from 'next/server';
import { apiErrorResponse, AppError } from './errors';
import { sessionCookie, type ResolvedSession } from './session';

export function attachSession(
  response: NextResponse,
  session?: ResolvedSession,
): NextResponse {
  if (session?.isNew) {
    response.headers.append('Set-Cookie', sessionCookie(session.sessionId));
  }
  return response;
}

export function jsonResponse<T>(
  data: T,
  options?: { status?: number; session?: ResolvedSession; headers?: Record<string, string> },
): NextResponse {
  const response = NextResponse.json(data, {
    status: options?.status ?? 200,
    headers: options?.headers,
  });
  return attachSession(response, options?.session);
}

export function errorResponse(
  error: unknown,
  session?: ResolvedSession,
): NextResponse {
  return attachSession(apiErrorResponse(error), session);
}

/**
 * 对浏览器发起的写请求做同源校验。
 * SameSite=Lax 已经能挡住大多数跨站表单 POST；这里再加一道 Origin 校验，
 * 避免公开部署后出现 CSRF 风险。没有 Origin 的非浏览器客户端（curl/脚本）不受影响。
 */
export function assertSameOrigin(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
    return;
  }
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('host');
  if (!host) return;

  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError('FORBIDDEN', '非法的请求来源。', { status: 403 });
  }

  if (originHost !== host) {
    throw new AppError('FORBIDDEN', '跨站请求被拒绝。', { status: 403 });
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError('BAD_REQUEST', '请求必须使用 application/json。');
  }
  const text = await request.text();
  if (text.length > 256 * 1024) {
    throw new AppError('BAD_REQUEST', '请求体过大。');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError('BAD_REQUEST', 'JSON 格式不合法。');
  }
}
