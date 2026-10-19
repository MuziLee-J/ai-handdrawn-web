import { describe, expect, it } from 'vitest';
import { createMockArtwork } from '@/lib/ai/mock-png';
import {
  detectMime,
  ImageValidationError,
  inspectImage,
} from '@/lib/server/images';

describe('image validation', () => {
  it('detects a valid PNG and reads dimensions', () => {
    const { buffer } = createMockArtwork(800, 600, 'watercolor');
    const detected = inspectImage(buffer, { maxPixels: 36_000_000 });
    expect(detected.mime).toBe('image/png');
    // 演示图生成器按原图比例输出，长边固定为 1024。
    expect(detected.width).toBe(1024);
    expect(detected.height).toBe(768);
    expect(detected.pixels).toBe(786_432);
  });

  it('detects JPEG and WebP signatures', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectMime(jpeg)?.mime).toBe('image/jpeg');

    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 ', 'ascii'),
    ]);
    expect(detectMime(webp)?.mime).toBe('image/webp');
  });

  it('rejects unsupported formats with a clear error code', () => {
    const gif = Buffer.from('GIF89a', 'ascii');
    expect(detectMime(gif)).toBeNull();
    expect(() => inspectImage(gif, { maxPixels: 1_000_000 })).toThrowError(
      ImageValidationError,
    );
    try {
      inspectImage(gif, { maxPixels: 1_000_000 });
    } catch (error) {
      expect((error as ImageValidationError).code).toBe(
        'UNSUPPORTED_IMAGE_FORMAT',
      );
    }
  });

  it('rejects images above the pixel limit', () => {
    const { buffer } = createMockArtwork(1024, 1024, 'pen-sketch');
    expect(() => inspectImage(buffer, { maxPixels: 1000 })).toThrowError(
      /像素过大/,
    );
  });
});
