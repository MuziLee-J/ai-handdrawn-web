import fs from 'node:fs';
import path from 'node:path';
import { createMockArtwork } from '../src/lib/ai/mock-png';
import { createTemplateDoc } from '../src/lib/editor/templates';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

let cookie = '';

function rememberCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
}

function requestHeaders(extra: Record<string, string> = {}) {
  return {
    ...extra,
    ...(cookie ? { cookie } : {}),
  };
}

async function assertOk(response: Response, label: string) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${label} failed: HTTP ${response.status} ${text}`);
  }
  rememberCookie(response);
}

async function main() {
  const dataDir = path.resolve(process.cwd(), '.data');
  fs.mkdirSync(dataDir, { recursive: true });

  console.log(`[1/8] session @ ${BASE}`);
  const sessionResponse = await fetch(`${BASE}/api/session`);
  await assertOk(sessionResponse, 'session');
  const session = (await sessionResponse.json()) as {
    quota: { remaining: number; limit: number };
    provider: { id: string; isMock: boolean } | null;
  };
  console.log('  provider:', session.provider);

  console.log('[2/8] generate a real PNG test buffer');
  const source = createMockArtwork(900, 700, 'watercolor');
  const sourcePath = path.join(dataDir, 'smoke-source.png');
  fs.writeFileSync(sourcePath, source.buffer);

  console.log('[3/8] upload source image');
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([new Uint8Array(source.buffer)], { type: 'image/png' }),
    'smoke-source.png',
  );
  const uploadResponse = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: requestHeaders(),
    body: formData,
  });
  await assertOk(uploadResponse, 'upload');
  const upload = (await uploadResponse.json()) as {
    asset: { id: string; url: string; width: number; height: number };
  };
  console.log('  asset:', upload.asset.id, upload.asset.width, upload.asset.height);

  console.log('[4/8] create generation task');
  const idempotencyKey = `smoke-${crypto.randomUUID()}`;
  const createResponse = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: requestHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      sourceAssetId: upload.asset.id,
      styleId: 'watercolor',
      fidelity: 'balanced',
      idempotencyKey,
    }),
  });
  await assertOk(createResponse, 'generate');
  const created = (await createResponse.json()) as {
    task: { id: string; status: string; provider: { isMock: boolean } };
  };
  console.log('  task:', created.task.id, created.task.status);

  console.log('[5/8] verify idempotency');
  const duplicateResponse = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: requestHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      sourceAssetId: upload.asset.id,
      styleId: 'watercolor',
      fidelity: 'balanced',
      idempotencyKey,
    }),
  });
  await assertOk(duplicateResponse, 'idempotent generate');
  const duplicate = (await duplicateResponse.json()) as {
    task: { id: string };
  };
  if (duplicate.task.id !== created.task.id) {
    throw new Error('idempotency failed: task ids differ');
  }
  console.log('  same task id returned:', duplicate.task.id);

  console.log('[6/8] poll task until terminal');
  let task: {
    id: string;
    status: string;
    result: { id: string; url: string; width: number; height: number } | null;
    error: { code: string; message: string } | null;
    provider: { isMock: boolean; label: string };
    costCents: number;
  } | null = null;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${BASE}/api/tasks/${created.task.id}`, {
      headers: requestHeaders(),
    });
    await assertOk(response, 'task poll');
    task = (await response.json()).task;
    console.log('  status:', task?.status);
    if (
      task?.status === 'succeeded' ||
      task?.status === 'failed' ||
      task?.status === 'cancelled'
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (!task || task.status !== 'succeeded' || !task.result) {
    throw new Error(`generation did not succeed: ${JSON.stringify(task)}`);
  }
  console.log(
    '  result:',
    task.result.width,
    task.result.height,
    'mock:',
    task.provider.isMock,
  );

  console.log('[7/8] download result and verify access control');
  const resultResponse = await fetch(`${BASE}${task.result.url}`, {
    headers: requestHeaders(),
  });
  await assertOk(resultResponse, 'download result');
  const resultBuffer = Buffer.from(await resultResponse.arrayBuffer());
  fs.writeFileSync(path.join(dataDir, 'smoke-result.png'), resultBuffer);
  console.log('  downloaded bytes:', resultBuffer.length);

  const unauthorized = await fetch(`${BASE}${task.result.url}`);
  if (unauthorized.status !== 404) {
    throw new Error(
      `access control failed: expected 404 without cookie, got ${unauthorized.status}`,
    );
  }
  console.log('  no-cookie access correctly rejected with 404');

  console.log('[8/8] artwork create/update/delete');
  const doc = createTemplateDoc('single-poster', {
    sourceAssetId: upload.asset.id,
    resultAssetId: task.result.id,
    title: '冒烟测试作品',
    date: '2026年10月18日',
  });
  const createWorkResponse = await fetch(`${BASE}/api/works`, {
    method: 'POST',
    headers: requestHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      title: '冒烟测试作品',
      doc,
      sourceAssetId: upload.asset.id,
      resultAssetId: task.result.id,
      styleId: 'watercolor',
      templateId: 'single-poster',
    }),
  });
  await assertOk(createWorkResponse, 'create work');
  const work = (await createWorkResponse.json()) as {
    work: { id: string; title: string };
  };
  console.log('  work:', work.work.id);

  const updateWorkResponse = await fetch(`${BASE}/api/works/${work.work.id}`, {
    method: 'PATCH',
    headers: requestHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ title: '冒烟测试作品（已更新）' }),
  });
  await assertOk(updateWorkResponse, 'update work');
  const updated = (await updateWorkResponse.json()) as {
    work: { title: string };
  };
  if (updated.work.title !== '冒烟测试作品（已更新）') {
    throw new Error('work update failed');
  }

  const listResponse = await fetch(`${BASE}/api/works`, {
    headers: requestHeaders(),
  });
  await assertOk(listResponse, 'list works');
  const list = (await listResponse.json()) as { works: Array<{ id: string }> };
  if (!list.works.some((item) => item.id === work.work.id)) {
    throw new Error('created work missing from list');
  }

  const deleteResponse = await fetch(`${BASE}/api/works/${work.work.id}`, {
    method: 'DELETE',
    headers: requestHeaders(),
  });
  await assertOk(deleteResponse, 'delete work');

  console.log('\nSMOKE TEST PASSED');
  console.log(
    JSON.stringify(
      {
        provider: session.provider,
        quotaBefore: session.quota,
        sourceAsset: upload.asset.id,
        taskId: created.task.id,
        resultAsset: task.result.id,
        resultBytes: resultBuffer.length,
        workId: work.work.id,
        note: session.provider?.isMock
          ? '本次使用程序化演示图，不是真实 AI 生成结果。'
          : '本次调用了真实 AI 供应商。',
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('\nSMOKE TEST FAILED');
  console.error(error);
  process.exit(1);
});
