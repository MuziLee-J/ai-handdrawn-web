/**
 * 探测当前账号已激活的 Seedream 模型。
 * 每个模型只发一次最小请求；未激活的请求不计费，已激活的成功请求会计费。
 * 一旦成功立即停止，避免重复生成。
 */
import { loadEnvConfig } from '@next/env';
import { createMockArtwork } from '../src/lib/ai/mock-png';

loadEnvConfig(process.cwd());

const MODELS = [
  'doubao-seedream-5-0-flash-260915',
  'doubao-seedream-5-0-pro-260628',
  'doubao-seedream-4-5-251128',
  'doubao-seedream-4-0-20260415',
  'doubao-seedream-4-0-250828',
];

async function main() {
  const key = process.env.ARK_API_KEY ?? '';
  const baseUrl = (
    process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
  ).replace(/\/$/, '');
  if (!key) throw new Error('ARK_API_KEY 为空');

  const image = createMockArtwork(512, 512, 'watercolor');
  const dataUrl = `data:image/png;base64,${image.buffer.toString('base64')}`;

  for (const model of MODELS) {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: '转换为水彩手绘风格，保留输入图主体。',
        image: dataUrl,
        size: '1024x1024',
        response_format: 'url',
        watermark: false,
      }),
    });
    const text = await response.text();
    let code = '';
    try {
      const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? '';
    } catch {
      code = '';
    }
    console.log(
      `${model}: HTTP ${response.status}${code ? ` ${code}` : ''} ${text.slice(0, 240)}`,
    );
    if (response.ok) {
      console.log('FOUND_ACTIVE_MODEL', model);
      return;
    }
  }
  console.log('NO_ACTIVE_MODEL');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
