import { describe, expect, it } from 'vitest';
import {
  ARK_MAX_PIXELS,
  ARK_MAX_SIDE,
  ARK_MIN_PIXELS,
  computeArkOutputSize,
} from '@/lib/ai/size';

describe('computeArkOutputSize', () => {
  const cases = [
    { w: 4000, h: 3000 },
    { w: 3000, h: 4000 },
    { w: 3000, h: 3000 },
    { w: 4000, h: 2250 },
    { w: 2250, h: 4000 },
    { w: 4000, h: 1000 },
    { w: 1000, h: 4000 },
    { w: 1080, h: 1920 },
    { w: 800, h: 600 },
  ];

  it.each(cases)('keeps ratio and Ark limits for $w x $h', ({ w, h }) => {
    const size = computeArkOutputSize(w, h);
    const pixels = size.width * size.height;
    expect(pixels).toBeGreaterThanOrEqual(ARK_MIN_PIXELS);
    expect(pixels).toBeLessThanOrEqual(ARK_MAX_PIXELS);
    expect(size.width).toBeLessThanOrEqual(ARK_MAX_SIDE);
    expect(size.height).toBeLessThanOrEqual(ARK_MAX_SIDE);
    const sourceAspect = w / h;
    const outputAspect = size.width / size.height;
    expect(Math.abs(sourceAspect - outputAspect)).toBeLessThan(0.03);
  });

  it('rejects invalid dimensions', () => {
    expect(() => computeArkOutputSize(0, 100)).toThrow();
    expect(() => computeArkOutputSize(Number.NaN, 100)).toThrow();
  });
});
