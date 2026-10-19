import { randomUUID } from 'node:crypto';
import {
  getProvider,
  getStylePreset,
  buildStyledPrompt,
  isCompositionMode,
  isFidelity,
  isStyleId,
} from '../ai';
import type { CompositionMode, Fidelity, StyleId } from '../ai/types';
import { getConfig } from './config';
import { getDb, nowIso, todayInShanghai } from './db';
import { AppError } from './errors';
import { getAssetRow } from './assets';
import { toAssetDto, type AssetDto } from './assets';
import { reserveQuota } from './quota';
import type { TaskRow } from './types';

export interface CreateTaskInput {
  sourceAssetId: string;
  styleId: unknown;
  fidelity: unknown;
  composition?: unknown;
  idempotencyKey: string;
}

export interface TaskDto {
  id: string;
  status: TaskRow['status'];
  styleId: StyleId;
  styleName: string;
  provider: {
    id: string;
    label: string;
    isMock: boolean;
  };
  model: string;
  fidelity: Fidelity;
  composition: CompositionMode;
  promptVersion: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  result: AssetDto | null;
  costCents: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function providerLabel(providerId: string): string {
  if (providerId === 'mock') return '演示图（非 AI）';
  if (providerId === 'ark') return '火山方舟 Seedream';
  return providerId;
}

export function toTaskDto(row: TaskRow): TaskDto {
  const style = getStylePreset(row.style_id);
  let result: AssetDto | null = null;
  if (row.result_asset_id) {
    const asset = getDb()
      .prepare('SELECT * FROM assets WHERE id = ? AND session_id = ?')
      .get(row.result_asset_id, row.session_id) as
      | import('./types').AssetRow
      | undefined;
    if (asset) result = toAssetDto(asset);
  }
  return {
    id: row.id,
    status: row.status,
    styleId: row.style_id,
    styleName: style.name,
    provider: {
      id: row.provider,
      label: providerLabel(row.provider),
      isMock: row.provider === 'mock',
    },
    model: row.model,
    fidelity: row.fidelity,
    composition: row.composition ?? 'full',
    promptVersion: row.prompt_version,
    error: row.error_code
      ? {
          code: row.error_code,
          message: row.error_message ?? '生成失败',
          retryable: row.error_retryable === 1,
        }
      : null,
    result,
    costCents: row.cost_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function getTaskRow(taskId: string): TaskRow {
  const row = getDb()
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(taskId) as TaskRow | undefined;
  if (!row) {
    throw new AppError('NOT_FOUND', '任务不存在。', { status: 404 });
  }
  return row;
}

export function getTaskForSession(taskId: string, sessionId: string): TaskRow {
  const row = getDb()
    .prepare('SELECT * FROM tasks WHERE id = ? AND session_id = ?')
    .get(taskId, sessionId) as TaskRow | undefined;
  if (!row) {
    throw new AppError('NOT_FOUND', '任务不存在或无权访问。', { status: 404 });
  }
  return row;
}

function findByIdempotency(
  sessionId: string,
  idempotencyKey: string,
): TaskRow | undefined {
  return getDb()
    .prepare('SELECT * FROM tasks WHERE session_id = ? AND idempotency_key = ?')
    .get(sessionId, idempotencyKey) as TaskRow | undefined;
}

export function createGenerationTask(
  sessionId: string,
  input: CreateTaskInput,
): { task: TaskDto; created: boolean } {
  if (
    typeof input.idempotencyKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)
  ) {
    throw new AppError('BAD_REQUEST', '幂等键格式不合法。');
  }
  if (!isStyleId(input.styleId)) {
    throw new AppError('BAD_REQUEST', '未知的绘画风格。');
  }
  const fidelity: Fidelity = isFidelity(input.fidelity)
    ? input.fidelity
    : 'balanced';

  let composition: CompositionMode = 'full';
  if (input.composition !== undefined) {
    if (!isCompositionMode(input.composition)) {
      throw new AppError('BAD_REQUEST', '未知的构图方式。');
    }
    composition = input.composition;
  }

  const existing = findByIdempotency(sessionId, input.idempotencyKey);
  if (existing) {
    return { task: toTaskDto(existing), created: false };
  }

  const source = getAssetRow(input.sourceAssetId, sessionId);
  if (source.kind !== 'source') {
    throw new AppError('BAD_REQUEST', '只有原始照片可以作为生成输入。');
  }

  let provider;
  try {
    provider = getProvider();
  } catch (error) {
    throw new AppError(
      'AI_NOT_CONFIGURED',
      error instanceof Error ? error.message : 'AI 服务未配置。',
      { status: 503 },
    );
  }

  const { prompt, promptVersion, styleVersion } = buildStyledPrompt(
    input.styleId,
    fidelity,
    composition,
  );

  // 先预占额度，再写入任务；如果并发写入触发唯一约束，退回额度。
  reserveQuota(sessionId);

  const id = randomUUID();
  const now = nowIso();

  try {
    getDb()
      .prepare(
        `INSERT INTO tasks (
          id, session_id, source_asset_id, style_id, style_version, prompt_version,
          provider, model, prompt, fidelity, composition, status, error_code,
          error_message, error_retryable, result_asset_id, provider_request_id,
          provider_usage_json, cost_cents, quota_reserved, idempotency_key,
          created_at, updated_at, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', NULL, NULL, 0, NULL, NULL, NULL, 0, 1, ?, ?, ?, NULL, NULL)`,
      )
      .run(
        id,
        sessionId,
        source.id,
        input.styleId,
        styleVersion,
        promptVersion,
        provider.id,
        provider.model,
        prompt,
        fidelity,
        composition,
        input.idempotencyKey,
        now,
        now,
      );
  } catch (error) {
    // 唯一约束竞争：另一个请求已经用同一个幂等键创建成功。
    const raced = findByIdempotency(sessionId, input.idempotencyKey);
    refundReservedQuota(sessionId);
    if (raced) {
      return { task: toTaskDto(raced), created: false };
    }
    throw error;
  }

  return { task: toTaskDto(getTaskRow(id)), created: true };
}

function refundReservedQuota(sessionId: string): void {
  const day = todayInShanghai();
  const db = getDb();
  db.prepare(
    'UPDATE usage SET used = MAX(0, used - 1) WHERE session_id = ? AND day = ?',
  ).run(sessionId, day);
  db.prepare(
    'UPDATE global_usage SET used = MAX(0, used - 1) WHERE day = ?',
  ).run(day);
}

export function markTaskProcessing(taskId: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE tasks
       SET status = 'processing', started_at = COALESCE(started_at, ?), updated_at = ?
       WHERE id = ? AND status = 'queued'`,
    )
    .run(nowIso(), nowIso(), taskId);
  return result.changes > 0;
}

export function finishTaskSuccess(params: {
  taskId: string;
  resultAssetId: string;
  providerRequestId?: string;
  usage?: Record<string, number>;
  costCents: number;
}): boolean {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `UPDATE tasks
       SET status = 'succeeded', result_asset_id = ?, provider_request_id = ?,
           provider_usage_json = ?, cost_cents = ?, quota_reserved = 0,
           error_code = NULL, error_message = NULL, error_retryable = 0,
           updated_at = ?, finished_at = ?
       WHERE id = ? AND status = 'processing'`,
    )
    .run(
      params.resultAssetId,
      params.providerRequestId ?? null,
      params.usage ? JSON.stringify(params.usage) : null,
      params.costCents,
      now,
      now,
      params.taskId,
    );
  return result.changes > 0;
}

export function finishTaskFailure(params: {
  taskId: string;
  code: string;
  message: string;
  retryable: boolean;
}): void {
  const db = getDb();
  db.transaction(() => {
    const row = db
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(params.taskId) as TaskRow | undefined;
    if (!row) return;
    if (row.status === 'cancelled') return;

    const now = nowIso();
    db.prepare(
      `UPDATE tasks
       SET status = 'failed', error_code = ?, error_message = ?, error_retryable = ?,
           quota_reserved = 0, updated_at = ?, finished_at = ?
       WHERE id = ? AND status IN ('queued', 'processing')`,
    ).run(
      params.code,
      params.message,
      params.retryable ? 1 : 0,
      now,
      now,
      params.taskId,
    );

    if (row.quota_reserved === 1) {
      refundReservedQuota(row.session_id);
    }
  })();
}

export function cancelQueuedTask(
  taskId: string,
  sessionId: string,
): TaskDto {
  const db = getDb();
  const now = nowIso();
  let refunded = false;

  db.transaction(() => {
    const row = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND session_id = ?')
      .get(taskId, sessionId) as TaskRow | undefined;
    if (!row) {
      throw new AppError('NOT_FOUND', '任务不存在或无权访问。', { status: 404 });
    }
    if (row.status === 'cancelled') return;
    if (row.status === 'succeeded' || row.status === 'failed') {
      throw new AppError('TASK_NOT_CANCELLABLE', '任务已结束，无法取消。', {
        status: 409,
      });
    }
    if (row.status === 'processing') {
      throw new AppError(
        'TASK_NOT_CANCELLABLE',
        '当前 AI 服务为同步生成，任务已被发送，无法取消；请等待本次结果。',
        { status: 409 },
      );
    }

    const result = db
      .prepare(
        `UPDATE tasks SET status = 'cancelled', quota_reserved = 0,
         updated_at = ?, finished_at = ? WHERE id = ? AND status = 'queued'`,
      )
      .run(now, now, taskId);
    if (result.changes > 0 && row.quota_reserved === 1) {
      refunded = true;
    }
  })();

  if (refunded) {
    refundReservedQuota(sessionId);
  }
  return toTaskDto(getTaskRow(taskId));
}

const globalForRecovery = globalThis as unknown as {
  __handdrawnRecoveryAt?: number;
};

/**
 * 服务重启后，内存中的任务不会再继续执行。
 * 将超时的 queued/processing 任务标记为失败并退回额度，避免用户看到永久“处理中”。
 * 每次创建任务时触发，但最多每 60 秒扫描一次，避免频繁全表查询。
 */
export function recoverStaleTasks(): void {
  const now = Date.now();
  if (
    globalForRecovery.__handdrawnRecoveryAt &&
    now - globalForRecovery.__handdrawnRecoveryAt < 60_000
  ) {
    return;
  }
  globalForRecovery.__handdrawnRecoveryAt = now;

  const config = getConfig();
  const cutoff = new Date(
    Date.now() - config.staleTaskMinutes * 60_000,
  ).toISOString();
  const db = getDb();
  const stale = db
    .prepare(
      `SELECT id FROM tasks
       WHERE status IN ('queued', 'processing') AND updated_at < ?`,
    )
    .all(cutoff) as Array<{ id: string }>;

  for (const task of stale) {
    finishTaskFailure({
      taskId: task.id,
      code: 'TASK_INTERRUPTED',
      message:
        '服务在生成过程中重启，任务已中断。额度已退回，可重新生成；供应商是否计费需以账单为准。',
      retryable: true,
    });
  }
}
