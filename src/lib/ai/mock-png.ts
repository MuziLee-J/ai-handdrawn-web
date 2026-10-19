import { deflateSync } from 'node:zlib';
import type { StyleId } from './types';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(
  width: number,
  height: number,
  rgb: Uint8Array,
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function noise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * 开发/测试用的程序化图片。
 * 它不是 AI 生成结果，UI 会标注“演示模式”，不得用于宣称模型能力。
 */
export function createMockArtwork(
  sourceWidth: number,
  sourceHeight: number,
  styleId: StyleId,
): { buffer: Buffer; width: number; height: number } {
  const aspect = sourceWidth / sourceHeight;
  const longEdge = 1024;
  const width =
    aspect >= 1 ? longEdge : Math.max(512, Math.round(longEdge * aspect));
  const height =
    aspect >= 1 ? Math.max(512, Math.round(longEdge / aspect)) : longEdge;

  const palettes: Record<StyleId, { base: string; wash: string; accent: string; ink: string }> = {
    watercolor: { base: '#FBF7EE', wash: '#9DB7AE', accent: '#D9A18A', ink: '#5D6B63' },
    'colored-pencil': { base: '#FBF7EE', wash: '#C9B79A', accent: '#C77D6A', ink: '#4A4540' },
    'pen-sketch': { base: '#FBF7EE', wash: '#D8D2C5', accent: '#8C7C68', ink: '#2F2D29' },
  };
  const palette = palettes[styleId];
  const base = hexToRgb(palette.base);
  const wash = hexToRgb(palette.wash);
  const accent = hexToRgb(palette.accent);
  const ink = hexToRgb(palette.ink);

  const rgb = new Uint8Array(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / width;
      const ny = y / height;
      const grain = (noise(x * 0.7, y * 0.7) - 0.5) * 10;
      let color: [number, number, number] = [...base];

      if (styleId === 'watercolor') {
        const blob1 = Math.exp(
          -(((nx - 0.32) ** 2) / 0.035 + ((ny - 0.38) ** 2) / 0.05),
        );
        const blob2 = Math.exp(
          -(((nx - 0.7) ** 2) / 0.05 + ((ny - 0.66) ** 2) / 0.04),
        );
        const band = 0.5 + 0.5 * Math.sin(ny * 12 + Math.sin(nx * 7) * 1.8);
        color = [
          base[0] + (wash[0] - base[0]) * blob1 * 0.8 + (accent[0] - base[0]) * blob2 * 0.45,
          base[1] + (wash[1] - base[1]) * blob1 * 0.8 + (accent[1] - base[1]) * blob2 * 0.45,
          base[2] + (wash[2] - base[2]) * blob1 * 0.8 + (accent[2] - base[2]) * blob2 * 0.45,
        ];
        color = color.map((channel, index) => channel + (wash[index] - base[index]) * band * 0.08) as [number, number, number];
      } else if (styleId === 'colored-pencil') {
        const hatching = (x + y * 2) % 14 < 2 ? 0.72 : 1;
        const cross = (x * 2 - y) % 22 < 2 ? 0.82 : 1;
        const patch = 0.5 + 0.5 * Math.sin(nx * 8) * Math.cos(ny * 6);
        color = [
          base[0] + (wash[0] - base[0]) * patch * 0.55,
          base[1] + (wash[1] - base[1]) * patch * 0.55,
          base[2] + (wash[2] - base[2]) * patch * 0.55,
        ];
        color = color.map((channel) => channel * hatching * cross) as [number, number, number];
      } else {
        const contour =
          Math.abs(Math.sin(nx * 9 + ny * 3.2)) < 0.055 ||
          Math.abs(Math.cos(nx * 4.4 - ny * 7.6)) < 0.05;
        const hatch =
          (x + y) % 11 < 1 && ny > 0.55 && ny < 0.9 ? 0.7 : 1;
        color = contour
          ? [ink[0], ink[1], ink[2]]
          : [base[0] * hatch, base[1] * hatch, base[2] * hatch];
      }

      const index = (y * width + x) * 3;
      rgb[index] = clampByte(color[0] + grain);
      rgb[index + 1] = clampByte(color[1] + grain);
      rgb[index + 2] = clampByte(color[2] + grain);
    }
  }

  return { buffer: encodePng(width, height, rgb), width, height };
}
