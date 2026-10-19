/**
 * 直接检查火山方舟配置：打印 HTTP 状态与原始错误（不打印 Key）。
 * 成功时会发起一次真实生成（可能产生约 0.20 元费用）。
 */
import { loadEnvConfig } from '@next/env';
import { createMockArtwork } from '../src/lib/ai/mock-png';

loadEnvConfig(process.cwd());

async function main() {
  const key = process.env.ARK_API_KEY ?? '';
  const baseUrl = (
    process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
  ).replace(/\/$/, '');
  const model = process.env.ARK_MODEL ?? 'doubao-seedream-4-0-250828';

  console.log('baseUrl:', baseUrl);
  console.log('model:', model);
  console.log('key length:', key.length, 'prefix:', key.slice(0, 4) + '...');

  if (!key) throw new Error('ARK_API_KEY 为空');

  const image = createMockArtwork(512, 512, 'watercolor');
  const dataUrl = `data:image/png;base64,${image.buffer.toString('base64')}`;

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: '将输入图片转换为水彩手绘风格，保留主体和构图。',
      image: dataUrl,
      size: '1024x1024',
      sequential_image_generation: 'disabled',
      response_format: 'url',
      watermark: false,
    }),
  });

  console.log('HTTP status:', response.status);
  console.log('x-request-id:', response.headers.get('x-request-id'));
  console.log('x-tt-logid:', response.headers.get('x-tt-logid'));
  const text = await response.text();
  console.log('body:', text.slice(0, 2000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
