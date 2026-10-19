/**
 * Seedream 4.0 的显式尺寸限制：
 * - 总像素 921,600 – 16,777,216
 * - 宽高比 1/16 – 16
 * - 单边不超过 4096（本实现主动限制）
 */
export const ARK_MIN_PIXELS = 921_600;
export const ARK_MAX_PIXELS = 16_777_216;
export const ARK_MAX_SIDE = 4096;
const TARGET_LONG_EDGE = 2048;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundEven(value: number) {
  const rounded = Math.round(value / 2) * 2;
  return Math.max(16, rounded);
}

export interface OutputSize {
  width: number;
  height: number;
}

/**
 * 根据原图比例计算一个接近 2K、同时满足方舟像素限制的输出尺寸。
 * 这不是“放大预览图”，而是交给模型的真实输出尺寸。
 */
export function computeArkOutputSize(
  sourceWidth: number,
  sourceHeight: number,
): OutputSize {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error('无效的图片尺寸');
  }

  const aspect = clamp(sourceWidth / sourceHeight, 1 / 16, 16);
  const landscape = aspect >= 1;
  let longEdge = TARGET_LONG_EDGE;
  let shortEdge = landscape ? longEdge / aspect : longEdge * aspect;

  while (longEdge * shortEdge < ARK_MIN_PIXELS) {
    longEdge *= 1.08;
    shortEdge = landscape ? longEdge / aspect : longEdge * aspect;
  }

  if (longEdge > ARK_MAX_SIDE) {
    longEdge = ARK_MAX_SIDE;
    shortEdge = landscape ? longEdge / aspect : longEdge * aspect;
  }

  let width = roundEven(landscape ? longEdge : shortEdge);
  let height = roundEven(landscape ? shortEdge : longEdge);

  // 取整可能让总像素略低于下限，做一次保守修正。
  // aspect 已被限制在 [1/16, 16]，最大边长下总像素必然高于下限，
  // 因此这个循环有明确上界，不会无限扩张短边。
  for (let attempt = 0; attempt < 64; attempt += 1) {
    if (
      width * height >= ARK_MIN_PIXELS &&
      width <= ARK_MAX_SIDE &&
      height <= ARK_MAX_SIDE
    ) {
      break;
    }
    if (width >= height) {
      width = Math.min(ARK_MAX_SIDE, width + 2);
      height = roundEven(width / aspect);
    } else {
      height = Math.min(ARK_MAX_SIDE, height + 2);
      width = roundEven(height * aspect);
    }
  }

  if (width * height > ARK_MAX_PIXELS) {
    const scale = Math.sqrt(ARK_MAX_PIXELS / (width * height));
    width = roundEven(width * scale);
    height = roundEven(height * scale);
  }

  return { width, height };
}
