/**
 * 通过产品 API（而不是直接调用 Ark）验证“满版 / 手账留白”构图。
 *
 *   SOURCE=/path/to/photo.jpg npx tsx scripts/ui-composition-check.ts
 *   SOURCE=/path/to/photo.jpg STYLE=pen-sketch COMPOSITION=sketchbook \
 *     npx tsx scripts/ui-composition-check.ts
 *
 * 需要一个已配置 ARK_API_KEY 的本地 dev server。
 * 会真实调用 AI 并产生费用（默认参考费用 0.12 元/张），不会打印 Key。
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const COMPOSITION =
  process.env.COMPOSITION === 'full' ? 'full' : 'sketchbook';
const STYLE = process.env.STYLE ?? 'watercolor';
const SOURCE = process.env.SOURCE ?? '';
const OUT_DIR = path.resolve('test-results', 'checks');
const OUT_FILE = path.join(OUT_DIR, `${STYLE}-${COMPOSITION}.jpg`);
const REPORT_FILE = path.join(OUT_DIR, `${STYLE}-${COMPOSITION}.json`);

interface Task {
  id: string;
  status: string;
  styleId: string;
  composition: string;
  promptVersion: string;
  model: string;
  provider: { id: string; isMock: boolean };
  error: { code: string; message: string } | null;
  result: { url: string; width: number; height: number } | null;
  costCents: number;
  createdAt: string;
  finishedAt: string | null;
}

let cookie = '';

function headers(extra: Record<string, string> = {}) {
  return { ...extra, ...(cookie ? { cookie } : {}) };
}

function rememberCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
}

async function fail(response: Response, label: string): Promise<never> {
  throw new Error(`${label} HTTP ${response.status}: ${await response.text()}`);
}

async function main() {
  if (!SOURCE) {
    throw new Error('请通过 SOURCE=/path/to/photo.jpg 指定一张自有照片。');
  }
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`源照片不存在：${SOURCE}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sessionResponse = await fetch(`${BASE}/api/session`);
  if (!sessionResponse.ok) await fail(sessionResponse, 'session');
  rememberCookie(sessionResponse);
  const session = (await sessionResponse.json()) as {
    provider: { id: string; isMock: boolean; model: string } | null;
    aiConfigured: boolean;
    quota: { remaining: number };
  };
  if (
    !session.provider ||
    session.provider.isMock ||
    session.provider.id !== 'ark'
  ) {
    throw new Error(
      '当前服务端不是真实 Ark provider。请确认 .env.local 并重启 dev server。',
    );
  }
  if (session.quota.remaining < 1) {
    throw new Error('今日生成额度已用完。');
  }

  const normalized = await sharp(fs.readFileSync(SOURCE))
    .rotate()
    .jpeg({ quality: 95 })
    .toBuffer();
  const metadata = await sharp(normalized).metadata();
  console.log(
    `source normalized: ${metadata.width}x${metadata.height}, composition=${COMPOSITION}, style=${STYLE}`,
  );

  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(normalized)], { type: 'image/jpeg' }),
    'composition-check.jpg',
  );
  const uploadResponse = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: headers(),
    body: form,
  });
  if (!uploadResponse.ok) await fail(uploadResponse, 'upload');
  rememberCookie(uploadResponse);
  const upload = (await uploadResponse.json()) as { asset: { id: string } };

  const createResponse = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      sourceAssetId: upload.asset.id,
      styleId: STYLE,
      fidelity: 'balanced',
      composition: COMPOSITION,
      idempotencyKey: `ui-${COMPOSITION}-${Date.now()}`,
    }),
  });
  if (!createResponse.ok) await fail(createResponse, 'generate');
  rememberCookie(createResponse);
  const created = (await createResponse.json()) as { task: Task };
  const taskId = created.task.id;
  console.log(`created task ${taskId} (${created.task.status})`);
  const startedAt = Date.now();

  let task = created.task;
  const timeoutAt = Date.now() + 4 * 60_000;
  while (task.status === 'queued' || task.status === 'processing') {
    if (Date.now() > timeoutAt) {
      throw new Error(`等待任务超时：${taskId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(`${BASE}/api/tasks/${taskId}`, {
      headers: headers(),
    });
    if (!response.ok) await fail(response, `task ${taskId}`);
    rememberCookie(response);
    task = ((await response.json()) as { task: Task }).task;
    console.log(`task status: ${task.status}`);
  }

  if (task.status !== 'succeeded' || !task.result) {
    throw new Error(
      `任务未成功：${task.status} ${task.error?.code ?? ''} ${task.error?.message ?? ''}`,
    );
  }

  const imageResponse = await fetch(`${BASE}${task.result.url}`, {
    headers: headers(),
  });
  if (!imageResponse.ok) await fail(imageResponse, 'download result');
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  fs.writeFileSync(OUT_FILE, buffer);

  const report = {
    checkedAt: new Date().toISOString(),
    source: {
      file: SOURCE,
      width: metadata.width,
      height: metadata.height,
    },
    request: { style: STYLE, composition: COMPOSITION, fidelity: 'balanced' },
    task: {
      id: task.id,
      status: task.status,
      model: task.model,
      composition: task.composition,
      promptVersion: task.promptVersion,
      provider: task.provider,
      resultWidth: task.result.width,
      resultHeight: task.result.height,
      costCents: task.costCents,
      durationMs: Date.now() - startedAt,
      createdAt: task.createdAt,
      finishedAt: task.finishedAt,
    },
    output: OUT_FILE,
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log(`succeeded: ${OUT_FILE}`);
  console.log(
    `${task.result.width}x${task.result.height}, ${((Date.now() - startedAt) / 1000).toFixed(1)}s, reference ¥${(task.costCents / 100).toFixed(2)}`,
  );
  console.log(`report: ${REPORT_FILE}`);
}

main().catch((error) => {
  console.error('UI COMPOSITION CHECK FAILED');
  console.error(error);
  process.exit(1);
});
