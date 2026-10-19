import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { applyComposition } from '@/lib/ai/composition';

async function pixelAt(buffer: Buffer, left: number, top: number) {
  const { data } = await sharp(buffer)
    .extract({ left, top, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

describe('composition post-processing', () => {
  it('centers the AI art on a warm paper canvas for sketchbook mode', async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 300,
        channels: 3,
        background: '#CC2200',
      },
    })
      .jpeg()
      .toBuffer();

    const output = await applyComposition(source, 'sketchbook');
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(300);

    const corner = await pixelAt(output, 2, 2);
    expect(Math.abs(corner.r - 0xfb)).toBeLessThanOrEqual(4);
    expect(Math.abs(corner.g - 0xf7)).toBeLessThanOrEqual(4);
    expect(Math.abs(corner.b - 0xee)).toBeLessThanOrEqual(4);

    const center = await pixelAt(output, 100, 150);
    expect(center.r).toBeGreaterThan(160);
    expect(center.g).toBeLessThan(80);
    expect(center.b).toBeLessThan(60);
  });

  it('returns the original buffer for full-frame mode', async () => {
    const source = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#336699',
      },
    })
      .png()
      .toBuffer();
    expect(await applyComposition(source, 'full')).toBe(source);
  });
});
