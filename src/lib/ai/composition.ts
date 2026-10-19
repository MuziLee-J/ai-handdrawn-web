import sharp from 'sharp';
import type { CompositionMode } from './types';

/**
 * 手账留白的兜底排版。
 *
 * 提示词已经要求模型在主体周围留白，但图生图模型并不总是可靠遵守。
 * 这里把 AI 结果缩小后放到米白纸张中央，保证产品里的“手账留白”真的有
 * 大面积纸边，而不是只靠模型自由发挥。图片内容仍然完全来自 AI，
 * 这里只做纸张留白排版，不生成或替换画面。
 */
const PAPER_COLOR = '#FBF7EE';
const ART_SCALE = 0.72;

export async function applyComposition(
  buffer: Buffer,
  composition: CompositionMode,
): Promise<Buffer> {
  if (composition !== 'sketchbook') return buffer;

  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) return buffer;

  const maxWidth = Math.max(1, Math.round(metadata.width * ART_SCALE));
  const maxHeight = Math.max(1, Math.round(metadata.height * ART_SCALE));

  const art = await sharp(buffer)
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92 })
    .toBuffer();
  const artMetadata = await sharp(art).metadata();
  const artWidth = artMetadata.width ?? maxWidth;
  const artHeight = artMetadata.height ?? maxHeight;
  const left = Math.round((metadata.width - artWidth) / 2);
  const top = Math.round((metadata.height - artHeight) / 2);

  return sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 3,
      background: PAPER_COLOR,
    },
  })
    .composite([{ input: art, left, top }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
