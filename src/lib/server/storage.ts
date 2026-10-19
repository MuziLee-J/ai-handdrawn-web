import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from './config';

const globalForStorage = globalThis as unknown as {
  __handdrawnDirsReady?: boolean;
};

export function ensureStorageDirs(): string {
  const { dataDir } = getConfig();
  const root = path.join(dataDir, 'files');
  if (!globalForStorage.__handdrawnDirsReady) {
    fs.mkdirSync(path.join(root, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(root, 'generated'), { recursive: true });
    globalForStorage.__handdrawnDirsReady = true;
  }
  return root;
}

/**
 * storageKey 只由服务端生成，格式为 uploads/<uuid>.<ext> 或 generated/<uuid>.<ext>。
 * 这里仍做一次路径校验，防止未来调用方传入不可信值。
 */
function resolveStoragePath(storageKey: string): string {
  const root = ensureStorageDirs();
  // Windows 的 path.normalize 会把分隔符改成反斜杠，先按 POSIX 形式校验。
  const normalized = storageKey.replace(/\\/g, '/');
  if (
    normalized.startsWith('..') ||
    path.isAbsolute(normalized) ||
    !/^(uploads|generated)\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(normalized)
  ) {
    throw new Error('非法的存储路径');
  }
  return path.join(root, ...normalized.split('/'));
}

export async function saveAssetFile(
  storageKey: string,
  buffer: Buffer,
): Promise<void> {
  const target = resolveStoragePath(storageKey);
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temp, buffer, { mode: 0o600 });
  await fsp.rename(temp, target);
}

export function readAssetFile(storageKey: string): Buffer {
  return fs.readFileSync(resolveStoragePath(storageKey));
}

export async function removeAssetFile(storageKey: string): Promise<void> {
  try {
    await fsp.unlink(resolveStoragePath(storageKey));
  } catch {
    // 文件已不存在时忽略。
  }
}

export function assetUrl(assetId: string): string {
  return `/api/files/${assetId}`;
}
