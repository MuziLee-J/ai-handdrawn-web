import { imageSize } from 'image-size';

export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface DetectedImage {
  mime: SupportedMime;
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  pixels: number;
}

export class ImageValidationError extends Error {
  readonly code:
    | 'UNSUPPORTED_IMAGE_FORMAT'
    | 'INVALID_IMAGE'
    | 'IMAGE_TOO_LARGE'
    | 'IMAGE_DIMENSIONS_INVALID';

  constructor(code: ImageValidationError['code'], message: string) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
  }
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function detectMime(buffer: Buffer): {
  mime: SupportedMime;
  extension: 'jpg' | 'png' | 'webp';
} | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

export function inspectImage(
  buffer: Buffer,
  limits: { maxPixels: number },
): DetectedImage {
  const mimeInfo = detectMime(buffer);
  if (!mimeInfo) {
    throw new ImageValidationError(
      'UNSUPPORTED_IMAGE_FORMAT',
      '仅支持 JPEG、PNG、WebP 图片；HEIC/HEIF 请先在设备上转换为 JPEG。',
    );
  }

  let dimensions: ReturnType<typeof imageSize>;
  try {
    dimensions = imageSize(buffer);
  } catch {
    throw new ImageValidationError('INVALID_IMAGE', '无法读取图片信息，文件可能已损坏。');
  }

  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;
  if (width < 16 || height < 16 || width > 12000 || height > 12000) {
    throw new ImageValidationError(
      'IMAGE_DIMENSIONS_INVALID',
      '图片尺寸不合理，宽高需在 16–12000 像素之间。',
    );
  }

  const pixels = width * height;
  if (pixels > limits.maxPixels) {
    throw new ImageValidationError(
      'IMAGE_TOO_LARGE',
      `图片像素过大（${width}×${height}），请压缩到 ${Math.floor(
        limits.maxPixels / 1_000_000,
      )} 百万像素以内。`,
    );
  }

  return {
    mime: mimeInfo.mime,
    extension: mimeInfo.extension,
    width,
    height,
    pixels,
  };
}
