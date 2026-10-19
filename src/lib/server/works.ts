import { randomUUID } from 'node:crypto';
import { isStyleId } from '../ai';
import type { EditorDoc } from '../editor/types';
import { parseEditorDoc, assertDocSize, collectAssetIds } from '../editor/validation';
import { assetUrl } from './storage';
import { getOptionalAssetRow, assertAssetsOwned, toAssetDto } from './assets';
import { getDb, nowIso } from './db';
import { AppError } from './errors';
import type { WorkRow } from './types';

export interface WorkDto {
  id: string;
  title: string;
  doc: EditorDoc;
  sourceAsset: ReturnType<typeof toAssetDto> | null;
  resultAsset: ReturnType<typeof toAssetDto> | null;
  styleId: string | null;
  templateId: string | null;
  providerId: string | null;
  isMock: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkInput {
  title: string;
  doc: unknown;
  sourceAssetId?: string | null;
  resultAssetId?: string | null;
  styleId?: string | null;
  templateId?: string | null;
}

const MAX_TITLE_LENGTH = 80;

function normalizeTitle(title: unknown): string {
  if (typeof title !== 'string') {
    throw new AppError('BAD_REQUEST', '作品标题不合法。');
  }
  const value = title.trim();
  if (!value || value.length > MAX_TITLE_LENGTH) {
    throw new AppError(
      'BAD_REQUEST',
      `作品标题长度需在 1–${MAX_TITLE_LENGTH} 个字符之间。`,
    );
  }
  return value;
}

function validateDoc(input: unknown): EditorDoc {
  try {
    assertDocSize(input);
    return parseEditorDoc(input);
  } catch (error) {
    throw new AppError(
      'INVALID_LAYOUT',
      error instanceof Error ? `排版文档不合法：${error.message}` : '排版文档不合法。',
      { status: 400 },
    );
  }
}

function toWorkDto(row: WorkRow): WorkDto {
  const doc = parseEditorDoc(JSON.parse(row.doc_json));
  const source = getOptionalAssetRow(row.source_asset_id, row.session_id);
  const result = getOptionalAssetRow(row.result_asset_id, row.session_id);
  const firstImage = doc.elements.find((element) => element.type === 'image');
  const resultTask = row.result_asset_id
    ? (getDb()
        .prepare(
          `SELECT provider FROM tasks
           WHERE session_id = ? AND result_asset_id = ?
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(row.session_id, row.result_asset_id) as
        | { provider: string }
        | undefined)
    : undefined;
  return {
    id: row.id,
    title: row.title,
    doc,
    sourceAsset: source ? toAssetDto(source) : null,
    resultAsset: result ? toAssetDto(result) : null,
    styleId: row.style_id,
    templateId: row.template_id,
    providerId: resultTask?.provider ?? null,
    isMock: resultTask?.provider === 'mock',
    thumbnailUrl:
      result
        ? assetUrl(result.id)
        : firstImage && firstImage.type === 'image'
          ? assetUrl(firstImage.assetId)
          : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWork(
  sessionId: string,
  input: CreateWorkInput,
): WorkDto {
  const title = normalizeTitle(input.title);
  const doc = validateDoc(input.doc);
  const assetIds = collectAssetIds(doc);
  if (input.sourceAssetId) assetIds.push(input.sourceAssetId);
  if (input.resultAssetId) assetIds.push(input.resultAssetId);
  assertAssetsOwned(sessionId, Array.from(new Set(assetIds)));

  if (input.sourceAssetId) {
    getOptionalAssetRow(input.sourceAssetId, sessionId);
  }
  if (input.resultAssetId) {
    getOptionalAssetRow(input.resultAssetId, sessionId);
  }

  const styleId = isStyleId(input.styleId) ? input.styleId : null;
  const id = randomUUID();
  const now = nowIso();

  getDb()
    .prepare(
      `INSERT INTO works (
        id, session_id, title, doc_json, source_asset_id, result_asset_id,
        style_id, template_id, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      id,
      sessionId,
      title,
      JSON.stringify(doc),
      input.sourceAssetId ?? null,
      input.resultAssetId ?? null,
      styleId,
      input.templateId ?? null,
      now,
      now,
    );

  return toWorkDto(getWorkRow(id, sessionId));
}

export function getWorkRow(workId: string, sessionId: string): WorkRow {
  const row = getDb()
    .prepare(
      'SELECT * FROM works WHERE id = ? AND session_id = ? AND deleted_at IS NULL',
    )
    .get(workId, sessionId) as WorkRow | undefined;
  if (!row) {
    throw new AppError('NOT_FOUND', '作品不存在或无权访问。', { status: 404 });
  }
  return row;
}

export function getWork(workId: string, sessionId: string): WorkDto {
  return toWorkDto(getWorkRow(workId, sessionId));
}

export function listWorks(sessionId: string): WorkDto[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM works WHERE session_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC LIMIT 50`,
    )
    .all(sessionId) as WorkRow[];
  return rows.map(toWorkDto);
}

export function updateWork(
  workId: string,
  sessionId: string,
  input: { title?: unknown; doc?: unknown },
): WorkDto {
  getWorkRow(workId, sessionId);

  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    sets.push('title = ?');
    values.push(normalizeTitle(input.title));
  }
  if (input.doc !== undefined) {
    const doc = validateDoc(input.doc);
    assertAssetsOwned(sessionId, collectAssetIds(doc));
    sets.push('doc_json = ?');
    values.push(JSON.stringify(doc));
  }

  if (sets.length === 0) {
    throw new AppError('BAD_REQUEST', '没有需要更新的字段。');
  }

  sets.push('updated_at = ?');
  values.push(nowIso());
  values.push(workId, sessionId);

  getDb()
    .prepare(
      `UPDATE works SET ${sets.join(', ')}
       WHERE id = ? AND session_id = ? AND deleted_at IS NULL`,
    )
    .run(...values);

  return getWork(workId, sessionId);
}

export function deleteWork(workId: string, sessionId: string): void {
  getWorkRow(workId, sessionId);
  getDb()
    .prepare(
      'UPDATE works SET deleted_at = ?, updated_at = ? WHERE id = ? AND session_id = ?',
    )
    .run(nowIso(), nowIso(), workId, sessionId);
}
