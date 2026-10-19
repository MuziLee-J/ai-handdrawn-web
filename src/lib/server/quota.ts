import { getConfig } from './config';
import { getDb, todayInShanghai } from './db';
import { AppError } from './errors';

export interface QuotaSnapshot {
  used: number;
  limit: number;
  remaining: number;
  globalUsed: number;
  globalLimit: number;
}

export function getQuota(sessionId: string): QuotaSnapshot {
  const config = getConfig();
  const day = todayInShanghai();
  const db = getDb();
  const local = db
    .prepare('SELECT used FROM usage WHERE session_id = ? AND day = ?')
    .get(sessionId, day) as { used: number } | undefined;
  const global = db
    .prepare('SELECT used FROM global_usage WHERE day = ?')
    .get(day) as { used: number } | undefined;

  const used = local?.used ?? 0;
  return {
    used,
    limit: config.dailyLimitPerSession,
    remaining: Math.max(0, config.dailyLimitPerSession - used),
    globalUsed: global?.used ?? 0,
    globalLimit: config.dailyLimitGlobal,
  };
}

/**
 * 创建任务时预占额度。必须在同一事务内检查并递增，避免并发请求绕过额度。
 */
export function reserveQuota(sessionId: string): QuotaSnapshot {
  const config = getConfig();
  const day = todayInShanghai();
  const db = getDb();

  const transaction = db.transaction(() => {
    const local = db
      .prepare('SELECT used FROM usage WHERE session_id = ? AND day = ?')
      .get(sessionId, day) as { used: number } | undefined;
    const global = db
      .prepare('SELECT used FROM global_usage WHERE day = ?')
      .get(day) as { used: number } | undefined;

    const used = local?.used ?? 0;
    const globalUsed = global?.used ?? 0;

    if (used >= config.dailyLimitPerSession) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        `今日生成次数已用完（${config.dailyLimitPerSession} 次）。请在明天再试，或先使用已有作品。`,
        { status: 429 },
      );
    }
    if (globalUsed >= config.dailyLimitGlobal) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        '今日全站生成额度已用完，请稍后再试。',
        { status: 429 },
      );
    }

    db.prepare(
      `INSERT INTO usage (session_id, day, used) VALUES (?, ?, 1)
       ON CONFLICT(session_id, day) DO UPDATE SET used = used + 1`,
    ).run(sessionId, day);
    db.prepare(
      `INSERT INTO global_usage (day, used) VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET used = used + 1`,
    ).run(day);

    return {
      used: used + 1,
      limit: config.dailyLimitPerSession,
      remaining: Math.max(0, config.dailyLimitPerSession - used - 1),
      globalUsed: globalUsed + 1,
      globalLimit: config.dailyLimitGlobal,
    };
  });

  return transaction();
}

/** 任务失败或取消时退回预占额度；只有 quota_reserved=1 的任务需要调用。 */
export function refundQuota(sessionId: string): void {
  const day = todayInShanghai();
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE usage SET used = MAX(0, used - 1)
       WHERE session_id = ? AND day = ?`,
    ).run(sessionId, day);
    db.prepare(
      'UPDATE global_usage SET used = MAX(0, used - 1) WHERE day = ?',
    ).run(day);
  })();
}
