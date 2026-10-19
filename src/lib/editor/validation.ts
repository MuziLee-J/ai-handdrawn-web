import { z } from 'zod';
import { CANVAS_SIZES, type EditorDoc } from './types';

const colorSchema = z.string().min(1).max(32);
const numberSchema = z.number().finite().min(-100_000).max(100_000);
const sizeSchema = z.number().finite().min(0).max(100_000);

const baseElementSchema = z.object({
  id: z.string().min(1).max(80),
  x: numberSchema,
  y: numberSchema,
  width: sizeSchema,
  height: sizeSchema,
  rotation: z.number().finite().min(-360).max(360),
  opacity: z.number().finite().min(0).max(1),
  locked: z.boolean().optional(),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal('image'),
  assetId: z.string().min(8).max(80),
  fit: z.enum(['cover', 'contain']),
  cornerRadius: z.number().finite().min(0).max(500),
  stroke: colorSchema.optional(),
  strokeWidth: z.number().finite().min(0).max(50).optional(),
});

const textElementSchema = baseElementSchema.extend({
  type: z.literal('text'),
  text: z.string().min(1).max(2000),
  fontFamily: z.enum(['sans', 'serif', 'kai']),
  fontSize: z.number().finite().min(8).max(400),
  fontStyle: z.enum(['normal', 'bold']),
  fill: colorSchema,
  align: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().finite().min(0.8).max(3),
  letterSpacing: z.number().finite().min(-10).max(100),
});

const shapeElementSchema = baseElementSchema.extend({
  type: z.literal('shape'),
  shape: z.enum(['rect', 'line', 'ellipse', 'frame', 'dot']),
  fill: colorSchema.optional(),
  stroke: colorSchema.optional(),
  strokeWidth: z.number().finite().min(0).max(50).optional(),
});

const elementSchema = z.discriminatedUnion('type', [
  imageElementSchema,
  textElementSchema,
  shapeElementSchema,
]);

export const editorDocSchema = z
  .object({
    version: z.literal(1),
    ratio: z.enum(['3:4', '4:3', '1:1']),
    canvas: z.object({
      width: z.number().int().positive().max(4096),
      height: z.number().int().positive().max(4096),
      background: colorSchema,
      texture: z.enum(['none', 'paper']),
    }),
    elements: z.array(elementSchema).min(1).max(100),
  })
  .superRefine((doc, ctx) => {
    const expected = CANVAS_SIZES[doc.ratio];
    if (doc.canvas.width !== expected.width || doc.canvas.height !== expected.height) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '画布尺寸与比例不匹配',
        path: ['canvas'],
      });
    }
    const ids = new Set<string>();
    for (const element of doc.elements) {
      if (ids.has(element.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `元素 ID 重复：${element.id}`,
          path: ['elements'],
        });
      }
      ids.add(element.id);
    }
  });

export function parseEditorDoc(input: unknown): EditorDoc {
  return editorDocSchema.parse(input) as EditorDoc;
}

const MAX_DOC_BYTES = 512 * 1024;

export function assertDocSize(input: unknown): void {
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DOC_BYTES) {
    throw new Error('排版文档过大');
  }
}

export function collectAssetIds(doc: EditorDoc): string[] {
  return Array.from(
    new Set(
      doc.elements
        .filter((element) => element.type === 'image')
        .map((element) => element.assetId),
    ),
  );
}
