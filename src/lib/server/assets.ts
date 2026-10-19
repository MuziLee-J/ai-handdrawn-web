import { randomUUID } from 'node:crypto';
import { getConfig } from './config';
import { getDb, nowIso } from './db';
import { AppError } from './errors';
import { inspectImage } from './images';
import {
  assetUrl,
  readAssetFile,
  removeAssetFile,
  saveAssetFile,
} from './storage';
import type { AssetKind, AssetRow } from './types';

export interface AssetDto {
  id: string;
  kind: AssetKind;
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

export function toAssetDto(row: AssetRow): AssetDto {
  return {
    id: row.id,
    kind: row.kind,
    url: assetUrl(row.id),
    mime: row.mime,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    createdAt: row.created_at,
  };
}

export async function createAsset(params: {
  sessionId: string;
  kind: AssetKind;
  buffer: Buffer;
}): Promise<AssetRow> {
  const config = getConfig();
  const detected = inspectImage(params.buffer, {
    maxPixels: config.maxImagePixels,
  });

  const id = randomUUID();
  const storageKey = `${params.kind === 'source' ? 'uploads' : 'generated'}/${id}.${detected.extension}`;
  await saveAssetFile(storageKey, params.buffer);

  try {
    getDb()
      .prepare(
        `INSERT INTO assets (id, session_id, kind, storage_key, mime, width, height, bytes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        params.sessionId,
        params.kind,
        storageKey,
        detected.mime,
        detected.width,
        detected.height,
        params.buffer.length,
        nowIso(),
      );
  } catch (error) {
    await removeAssetFile(storageKey);
    throw error;
  }

  return getAssetRow(id, params.sessionId);
}

export function getAssetRow(assetId: string, sessionId: string): AssetRow {
  const row = getDb()
    .prepare('SELECT * FROM assets WHERE id = ? AND session_id = ?')
    .get(assetId, sessionId) as AssetRow | undefined;
  if (!row) {
    throw new AppError('NOT_FOUND', '图片不存在或无权访问。', { status: 404 });
  }
  return row;
}

export function getOptionalAssetRow(
  assetId: string | null | undefined,
  sessionId: string,
): AssetRow | null {
  if (!assetId) return null;
  const row = getDb()
    .prepare('SELECT * FROM assets WHERE id = ? AND session_id = ?')
    .get(assetId, sessionId) as AssetRow | undefined;
  return row ?? null;
}

export function readAssetBuffer(row: AssetRow): Buffer {
  return readAssetFile(row.storage_key);
}

export async function deleteAsset(row: AssetRow): Promise<void> {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(row.id);
  await removeAssetFile(row.storage_key);
}

export function assertAssetsOwned(sessionId: string, assetIds: string[]): void {
  for (const assetId of assetIds) {
    const row = getDb()
      .prepare('SELECT id FROM assets WHERE id = ? AND session_id = ?')
      .get(assetId, sessionId) as { id: string } | undefined;
    if (!row) {
      throw new AppError('NOT_FOUND', '排版文档引用了不存在或无权访问的图片。', {
        status: 404,
      });
    }
  }
}
