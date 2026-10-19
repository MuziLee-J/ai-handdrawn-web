export type CanvasRatio = '3:4' | '4:3' | '1:1';

export interface CanvasSize {
  width: number;
  height: number;
}

export const CANVAS_SIZES: Record<CanvasRatio, CanvasSize> = {
  '3:4': { width: 1200, height: 1600 },
  '4:3': { width: 1600, height: 1200 },
  '1:1': { width: 1400, height: 1400 },
};

export type ElementType = 'image' | 'text' | 'shape';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  fit: 'cover' | 'contain';
  cornerRadius: number;
  stroke?: string;
  strokeWidth?: number;
}

export type FontFamilyKey = 'sans' | 'serif' | 'kai';

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: FontFamilyKey;
  fontSize: number;
  fontStyle: 'normal' | 'bold';
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
}

export type ShapeKind = 'rect' | 'line' | 'ellipse' | 'frame' | 'dot';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type EditorElement = ImageElement | TextElement | ShapeElement;

export type PaperTexture = 'none' | 'paper';

export interface EditorCanvas {
  width: number;
  height: number;
  background: string;
  texture: PaperTexture;
}

export interface EditorDoc {
  version: 1;
  ratio: CanvasRatio;
  canvas: EditorCanvas;
  elements: EditorElement[];
}

export type TemplateId =
  | 'single-poster'
  | 'vertical-compare'
  | 'side-by-side'
  | 'free-collage';

export interface TemplatePreset {
  id: TemplateId;
  name: string;
  description: string;
  ratio: CanvasRatio;
}

export interface TemplateContext {
  sourceAssetId?: string;
  resultAssetId: string;
  title?: string;
  date?: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'single-poster',
    name: '单图艺术海报',
    description: '大图 + 标题 + 日期，适合作为主视觉。',
    ratio: '3:4',
  },
  {
    id: 'vertical-compare',
    name: '上下对照',
    description: '原图在上、手绘图在下，保留完整对比。',
    ratio: '3:4',
  },
  {
    id: 'side-by-side',
    name: '左右对照',
    description: '横向双图，适合电脑端展示与打印。',
    ratio: '4:3',
  },
  {
    id: 'free-collage',
    name: '自由拼贴',
    description: '大小图叠放，加入标题、日期与装饰。',
    ratio: '3:4',
  },
];
