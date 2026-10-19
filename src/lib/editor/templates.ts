import {
  CANVAS_SIZES,
  type EditorDoc,
  type EditorElement,
  type ImageElement,
  type ShapeElement,
  type TemplateContext,
  type TemplateId,
  type TextElement,
} from './types';

const PAPER = '#FBF8F1';
const INK = '#2B2A27';
const MUTED = '#6F6A60';

function formatDate(date?: string): string {
  if (date) return date;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function imageElement(
  id: string,
  assetId: string,
  box: { x: number; y: number; width: number; height: number },
  options?: Partial<ImageElement>,
): ImageElement {
  return {
    id,
    type: 'image',
    assetId,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    fit: 'cover',
    cornerRadius: 2,
    ...options,
  };
}

function textElement(
  id: string,
  text: string,
  box: { x: number; y: number; width: number; height: number },
  options?: Partial<TextElement>,
): TextElement {
  return {
    id,
    type: 'text',
    text,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    fontFamily: 'serif',
    fontSize: 64,
    fontStyle: 'normal',
    fill: INK,
    align: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    ...options,
  };
}

function shapeElement(
  id: string,
  shape: ShapeElement['shape'],
  box: { x: number; y: number; width: number; height: number },
  options?: Partial<ShapeElement>,
): ShapeElement {
  return {
    id,
    type: 'shape',
    shape,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    stroke: MUTED,
    strokeWidth: 2,
    ...options,
  };
}

function baseDoc(ratio: EditorDoc['ratio'], elements: EditorElement[]): EditorDoc {
  const size = CANVAS_SIZES[ratio];
  return {
    version: 1,
    ratio,
    canvas: {
      width: size.width,
      height: size.height,
      background: PAPER,
      texture: 'paper',
    },
    elements,
  };
}

export function createTemplateDoc(
  templateId: TemplateId,
  context: TemplateContext,
): EditorDoc {
  const title = context.title?.trim() || '未命名作品';
  const date = formatDate(context.date);
  const { sourceAssetId, resultAssetId } = context;

  if (templateId === 'vertical-compare') {
    const elements: EditorElement[] = [];
    if (sourceAssetId) {
      elements.push(
        imageElement('source-image', sourceAssetId, {
          x: 100,
          y: 90,
          width: 1000,
          height: 560,
        }),
      );
      elements.push(
        textElement(
          'source-label',
          '原始照片',
          { x: 100, y: 660, width: 300, height: 40 },
          { fontSize: 26, fill: MUTED, fontFamily: 'sans' },
        ),
      );
    }
    elements.push(
      imageElement('result-image', resultAssetId, {
        x: 100,
        y: 720,
        width: 1000,
        height: 560,
      }),
    );
    elements.push(
      textElement(
        'result-label',
        '手绘作品',
        { x: 100, y: 1290, width: 300, height: 40 },
        { fontSize: 26, fill: MUTED, fontFamily: 'sans' },
      ),
    );
    elements.push(
      textElement('title', title, {
        x: 100,
        y: 1370,
        width: 1000,
        height: 100,
      }),
    );
    elements.push(
      textElement(
        'date',
        date,
        { x: 100, y: 1480, width: 600, height: 40 },
        { fontSize: 28, fill: MUTED, fontFamily: 'sans' },
      ),
    );
    elements.push(
      shapeElement(
        'divider',
        'line',
        { x: 100, y: 1330, width: 1000, height: 2 },
        { stroke: '#D9D0C2', strokeWidth: 2 },
      ),
    );
    return baseDoc('3:4', elements);
  }

  if (templateId === 'side-by-side') {
    const elements: EditorElement[] = [
      textElement('title', title, {
        x: 80,
        y: 60,
        width: 1440,
        height: 90,
      }),
      textElement(
        'date',
        date,
        { x: 80, y: 140, width: 600, height: 36 },
        { fontSize: 26, fill: MUTED, fontFamily: 'sans' },
      ),
    ];
    if (sourceAssetId) {
      elements.push(
        imageElement('source-image', sourceAssetId, {
          x: 80,
          y: 210,
          width: 700,
          height: 900,
        }),
      );
      elements.push(
        textElement(
          'source-label',
          '原始照片',
          { x: 80, y: 1120, width: 300, height: 36 },
          { fontSize: 24, fill: MUTED, fontFamily: 'sans' },
        ),
      );
    }
    elements.push(
      imageElement('result-image', resultAssetId, {
        x: 820,
        y: 210,
        width: 700,
        height: 900,
      }),
    );
    elements.push(
      textElement(
        'result-label',
        '手绘作品',
        { x: 820, y: 1120, width: 300, height: 36 },
        { fontSize: 24, fill: MUTED, fontFamily: 'sans' },
      ),
    );
    return baseDoc('4:3', elements);
  }

  if (templateId === 'free-collage') {
    const elements: EditorElement[] = [
      imageElement(
        'result-image',
        resultAssetId,
        { x: 80, y: 80, width: 1040, height: 1040 },
        { rotation: -1.2 },
      ),
      shapeElement(
        'frame',
        'frame',
        { x: 60, y: 60, width: 1080, height: 1080 },
        { stroke: '#D9D0C2', strokeWidth: 2 },
      ),
      textElement('title', title, {
        x: 100,
        y: 1180,
        width: 1000,
        height: 100,
      }),
      textElement(
        'date',
        date,
        { x: 100, y: 1300, width: 600, height: 40 },
        { fontSize: 28, fill: MUTED, fontFamily: 'sans' },
      ),
      shapeElement(
        'divider',
        'line',
        { x: 100, y: 1150, width: 420, height: 2 },
        { stroke: '#C9BBA8', strokeWidth: 3 },
      ),
      shapeElement(
        'dot',
        'dot',
        { x: 990, y: 1180, width: 90, height: 90 },
        { fill: '#C77D6A', opacity: 0.75 },
      ),
    ];
    if (sourceAssetId) {
      elements.splice(
        2,
        0,
        imageElement(
          'source-image',
          sourceAssetId,
          { x: 820, y: 960, width: 280, height: 280 },
          { rotation: 4 },
        ),
      );
      elements.splice(
        3,
        0,
        shapeElement(
          'source-frame',
          'frame',
          { x: 806, y: 946, width: 308, height: 308 },
          { stroke: '#FBF8F1', strokeWidth: 8, rotation: 4 },
        ),
      );
    }
    return baseDoc('3:4', elements);
  }

  // single-poster
  const elements: EditorElement[] = [
    imageElement('result-image', resultAssetId, {
      x: 90,
      y: 90,
      width: 1020,
      height: 1020,
    }),
    shapeElement(
      'frame',
      'frame',
      { x: 70, y: 70, width: 1060, height: 1060 },
      { stroke: '#D9D0C2', strokeWidth: 2 },
    ),
    textElement('title', title, {
      x: 100,
      y: 1180,
      width: 1000,
      height: 100,
    }),
    textElement(
      'subtitle',
      '由照片转译的手绘作品',
      { x: 100, y: 1285, width: 800, height: 44 },
      { fontSize: 28, fill: MUTED, fontFamily: 'sans' },
    ),
    textElement(
      'date',
      date,
      { x: 100, y: 1450, width: 600, height: 40 },
      { fontSize: 26, fill: MUTED, fontFamily: 'sans' },
    ),
    shapeElement(
      'divider',
      'line',
      { x: 100, y: 1400, width: 1000, height: 2 },
      { stroke: '#D9D0C2', strokeWidth: 2 },
    ),
  ];
  return baseDoc('3:4', elements);
}

export function templateIdOrDefault(value: unknown): TemplateId {
  const ids: TemplateId[] = [
    'single-poster',
    'vertical-compare',
    'side-by-side',
    'free-collage',
  ];
  return ids.includes(value as TemplateId)
    ? (value as TemplateId)
    : 'single-poster';
}
