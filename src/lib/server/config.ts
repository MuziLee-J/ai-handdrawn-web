import path from 'node:path';

export interface AppConfig {
  dataDir: string;
  dbPath: string;
  maxUploadBytes: number;
  maxImagePixels: number;
  dailyLimitPerSession: number;
  dailyLimitGlobal: number;
  costCentsPerImage: number;
  allowMockAi: boolean;
  isProduction: boolean;
  taskConcurrency: number;
  staleTaskMinutes: number;
  generateRateLimitPerMinute: number;
  uploadRateLimitPerMinute: number;
}

function intEnv(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

export function getConfig(): AppConfig {
  const dataDir = path.resolve(
    // DATA_DIR 是运行时持久化卷，不能被打包器静态追踪。
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATA_DIR ?? '.data',
  );
  return {
    dataDir,
    dbPath: path.join(dataDir, 'app.db'),
    maxUploadBytes: intEnv('MAX_UPLOAD_MB', 15, 1) * 1024 * 1024,
    maxImagePixels: intEnv('MAX_IMAGE_PIXELS', 36_000_000, 1_000_000),
    dailyLimitPerSession: intEnv('DAILY_LIMIT_PER_SESSION', 10, 1),
    dailyLimitGlobal: intEnv('DAILY_LIMIT_GLOBAL', 60, 1),
    costCentsPerImage: intEnv('AI_COST_CENTS_PER_IMAGE', 12, 0),
    allowMockAi:
      (process.env.ALLOW_MOCK_AI ?? 'true').toLowerCase() === 'true' &&
      process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    taskConcurrency: intEnv('TASK_CONCURRENCY', 2, 1),
    staleTaskMinutes: intEnv('STALE_TASK_MINUTES', 10, 1),
    generateRateLimitPerMinute: intEnv(
      'RATE_LIMIT_GENERATE_PER_MINUTE',
      6,
      1,
    ),
    uploadRateLimitPerMinute: intEnv('RATE_LIMIT_UPLOAD_PER_MINUTE', 20, 1),
  };
}
