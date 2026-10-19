import { randomUUID } from 'node:crypto';
import { getDb, nowIso } from './db';

export const SESSION_COOKIE = 'hdsid';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

export function readSessionId(request: Request): string | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  const value = cookies[SESSION_COOKIE];
  return typeof value === 'string' && value.length >= 10 ? value : null;
}

export function sessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export interface ResolvedSession {
  sessionId: string;
  isNew: boolean;
}

/**
 * 读取匿名会话；没有则创建。调用方负责在响应中设置 Set-Cookie。
 */
export function ensureSession(request: Request): ResolvedSession {
  const db = getDb();
  const existing = readSessionId(request);
  const now = nowIso();

  if (existing) {
    const row = db
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .get(existing) as { id: string } | undefined;
    if (row) {
      db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(
        now,
        existing,
      );
      return { sessionId: existing, isNew: false };
    }
  }

  const sessionId = randomUUID();
  db.prepare(
    'INSERT INTO sessions (id, created_at, last_seen_at) VALUES (?, ?, ?)',
  ).run(sessionId, now, now);
  return { sessionId, isNew: true };
}

export function getSessionOrThrow(request: Request): string {
  const sessionId = readSessionId(request);
  if (!sessionId) {
    throw new Error('会话不存在');
  }
  const row = getDb()
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .get(sessionId) as { id: string } | undefined;
  if (!row) throw new Error('会话不存在');
  return sessionId;
}
