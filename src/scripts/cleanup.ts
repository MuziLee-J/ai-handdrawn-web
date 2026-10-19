/**
 * 本地数据清理脚本。
 *
 * 默认只预览，不删除；确认后加 --apply 才会真正删除。
 *
 *   npm run cleanup          # 预览
 *   npm run cleanup:apply    # 执行
 *
 * 策略：
 * - 软删除超过 30 天的作品：删除作品记录；
 * - 失败/取消超过 30 天的任务：删除任务记录；
 * - 未被任何任务或作品引用、且创建超过 7 天的素材：删除数据库记录与本地文件。
 *
 * 这是保守策略：只要有任何作品文档无法解析，就跳过孤立素材删除，
 * 避免误删仍然被引用的图片。
 */
import { loadEnvConfig } from '@next/env';
import { getDb } from '../lib/server/db';
import { collectAssetIds, parseEditorDoc } from '../lib/editor/validation';
import { removeAssetFile } from '../lib/server/storage';
import type { AssetRow, TaskRow, WorkRow } from '../lib/server/types';

// tsx 不会自动加载 Next 的 .env.local，必须显式加载，否则会操作错误的 DATA_DIR。
loadEnvConfig(process.cwd());

async function main() {
  const APPLY = process.argv.includes('--apply');
  const now = Date.now();
  const isoDaysAgo = (days: number) =>
    new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const db = getDb();

  const oldSoftDeletedWorks = db
    .prepare(
      `SELECT * FROM works
       WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
    )
    .all(isoDaysAgo(30)) as WorkRow[];

  const oldFinishedTasks = db
    .prepare(
      `SELECT * FROM tasks
       WHERE status IN ('failed', 'cancelled') AND updated_at < ?`,
    )
    .all(isoDaysAgo(30)) as TaskRow[];

  console.log(`[cleanup] mode=${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[cleanup] 软删除超过 30 天的作品：${oldSoftDeletedWorks.length}`);
  console.log(`[cleanup] 失败/取消超过 30 天的任务：${oldFinishedTasks.length}`);

  if (APPLY) {
    const removeWork = db.prepare('DELETE FROM works WHERE id = ?');
    const removeTask = db.prepare('DELETE FROM tasks WHERE id = ?');
    db.transaction(() => {
      for (const work of oldSoftDeletedWorks) removeWork.run(work.id);
      for (const task of oldFinishedTasks) removeTask.run(task.id);
    })();
  }

  // 计算仍然被引用的素材。必须在删除旧作品/旧任务之后统计。
  const remainingWorks = db
    .prepare('SELECT * FROM works WHERE deleted_at IS NULL')
    .all() as WorkRow[];
  const remainingTasks = db.prepare('SELECT * FROM tasks').all() as TaskRow[];

  const referenced = new Set<string>();
  let docsParsed = true;

  for (const task of remainingTasks) {
    referenced.add(task.source_asset_id);
    if (task.result_asset_id) referenced.add(task.result_asset_id);
  }

  for (const work of remainingWorks) {
    if (work.source_asset_id) referenced.add(work.source_asset_id);
    if (work.result_asset_id) referenced.add(work.result_asset_id);
    try {
      const doc = parseEditorDoc(JSON.parse(work.doc_json));
      for (const assetId of collectAssetIds(doc)) referenced.add(assetId);
    } catch (error) {
      docsParsed = false;
      console.warn(
        `[cleanup] 作品 ${work.id} 的排版文档无法解析，跳过孤立素材清理。`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!docsParsed) {
    console.log('[cleanup] 已完成作品/任务清理；孤立素材未处理。');
    return;
  }

  const orphanCandidates = db
    .prepare('SELECT * FROM assets WHERE created_at < ?')
    .all(isoDaysAgo(7)) as AssetRow[];

  const orphans = orphanCandidates.filter((asset) => !referenced.has(asset.id));
  console.log(`[cleanup] 可删除的孤立素材：${orphans.length}`);

  if (APPLY) {
    const removeAsset = db.prepare('DELETE FROM assets WHERE id = ?');
    for (const asset of orphans) {
      removeAsset.run(asset.id);
      await removeAssetFile(asset.storage_key);
    }
  }

  console.log(
    `[cleanup] 完成。${APPLY ? '已删除' : '预览'}：作品 ${oldSoftDeletedWorks.length}、任务 ${oldFinishedTasks.length}、孤立素材 ${orphans.length}。`,
  );
}

main().catch((error) => {
  console.error('[cleanup] 执行失败：', error);
  process.exit(1);
});
