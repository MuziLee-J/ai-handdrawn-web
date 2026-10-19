import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// 必须在导入 db 模块之前设置环境变量。
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handdrawn-quota-'));
process.env.DATA_DIR = tempDir;
process.env.DAILY_LIMIT_PER_SESSION = '2';
process.env.DAILY_LIMIT_GLOBAL = '3';

const { getDb, closeDbForTests } = await import('@/lib/server/db');
const { reserveQuota, refundQuota, getQuota } = await import(
  '@/lib/server/quota'
);

const now = new Date().toISOString();
const db = getDb();
for (const sessionId of ['session-a', 'session-b']) {
  db.prepare(
    'INSERT INTO sessions (id, created_at, last_seen_at) VALUES (?, ?, ?)',
  ).run(sessionId, now, now);
}

afterAll(() => {
  closeDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('daily quota reservation', () => {
  it('reserves, enforces per-session limit and refunds', () => {
    const first = reserveQuota('session-a');
    expect(first.used).toBe(1);
    expect(first.remaining).toBe(1);

    const second = reserveQuota('session-a');
    expect(second.used).toBe(2);
    expect(second.remaining).toBe(0);

    expect(() => reserveQuota('session-a')).toThrowError(
      /今日生成次数已用完/,
    );

    refundQuota('session-a');
    const afterRefund = getQuota('session-a');
    expect(afterRefund.used).toBe(1);

    const third = reserveQuota('session-a');
    expect(third.used).toBe(2);
  });

  it('enforces the global limit across sessions', () => {
    // 当前 session-a 已预占 2 次，global=2。
    const sessionB = reserveQuota('session-b');
    expect(sessionB.globalUsed).toBe(3);

    expect(() => reserveQuota('session-b')).toThrowError(/全站生成额度已用完/);
  });
});
