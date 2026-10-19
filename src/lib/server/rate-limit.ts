import { AppError } from './errors';

interface BucketState {
  hits: number[];
}

const globalForRateLimit = globalThis as unknown as {
  __handdrawnRateBuckets?: Map<string, BucketState>;
};

function buckets(): Map<string, BucketState> {
  if (!globalForRateLimit.__handdrawnRateBuckets) {
    globalForRateLimit.__handdrawnRateBuckets = new Map();
  }
  return globalForRateLimit.__handdrawnRateBuckets;
}

/**
 * 进程内滑动窗口限流，用于挡住短时间内的脚本刷接口。
 * 注意：多实例部署时每个实例独立计数；正式多实例部署应换成 Redis/网关限流。
 * 每日生成额度仍由 SQLite 事务保证。
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  const store = buckets();
  const current = store.get(key) ?? { hits: [] };
  const recent = current.hits.filter((time) => now - time < windowMs);

  if (recent.length >= limit) {
    throw new AppError(
      'RATE_LIMITED',
      '请求过于频繁，请稍后再试。',
      { status: 429, retryable: true },
    );
  }

  recent.push(now);
  store.set(key, { hits: recent });

  // 防止长期运行后 Map 无限增长。
  if (store.size > 5000) {
    for (const [bucketKey, value] of store) {
      if (value.hits.every((time) => now - time >= windowMs)) {
        store.delete(bucketKey);
      }
    }
  }
}
