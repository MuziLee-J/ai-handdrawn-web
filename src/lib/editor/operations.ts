import {
  CANVAS_SIZES,
  type CanvasRatio,
  type EditorDoc,
  type EditorElement,
  type ImageElement,
} from './types';

export function cloneDoc(doc: EditorDoc): EditorDoc {
  return JSON.parse(JSON.stringify(doc)) as EditorDoc;
}

export function createElementId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addElement(doc: EditorDoc, element: EditorElement): EditorDoc {
  const next = cloneDoc(doc);
  if (next.elements.some((item) => item.id === element.id)) {
    throw new Error('元素 ID 重复');
  }
  next.elements.push(element);
  return next;
}

export function updateElement(
  doc: EditorDoc,
  elementId: string,
  patch: Partial<EditorElement>,
): EditorDoc {
  const next = cloneDoc(doc);
  const index = next.elements.findIndex((item) => item.id === elementId);
  if (index === -1) throw new Error('元素不存在');
  const current = next.elements[index];
  const merged = { ...current, ...patch } as EditorElement;
  merged.id = current.id;
  merged.type = current.type;
  merged.width = Math.max(20, merged.width);
  merged.height = Math.max(20, merged.height);
  merged.opacity = Math.min(1, Math.max(0, merged.opacity));
  merged.rotation = Math.min(360, Math.max(-360, merged.rotation));
  next.elements[index] = merged;
  return next;
}

export function removeElement(doc: EditorDoc, elementId: string): EditorDoc {
  const next = cloneDoc(doc);
  next.elements = next.elements.filter((item) => item.id !== elementId);
  return next;
}

export type ReorderDirection = 'forward' | 'backward' | 'front' | 'back';

export function reorderElement(
  doc: EditorDoc,
  elementId: string,
  direction: ReorderDirection,
): EditorDoc {
  const next = cloneDoc(doc);
  const index = next.elements.findIndex((item) => item.id === elementId);
  if (index === -1) throw new Error('元素不存在');
  const [element] = next.elements.splice(index, 1);
  let target = index;
  if (direction === 'front') target = next.elements.length;
  if (direction === 'back') target = 0;
  if (direction === 'forward') target = Math.min(next.elements.length, index + 1);
  if (direction === 'backward') target = Math.max(0, index - 1);
  next.elements.splice(target, 0, element);
  return next;
}

export function duplicateElement(
  doc: EditorDoc,
  elementId: string,
): { doc: EditorDoc; newId: string } {
  const source = doc.elements.find((item) => item.id === elementId);
  if (!source) throw new Error('元素不存在');
  const newId = createElementId(source.type);
  const copy: EditorElement = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    x: source.x + 24,
    y: source.y + 24,
  };
  return { doc: addElement(doc, copy), newId };
}

/**
 * 切换画布比例时按比例缩放并居中现有元素，避免内容突然跑出画布。
 */
export function setCanvasRatio(doc: EditorDoc, ratio: CanvasRatio): EditorDoc {
  const next = cloneDoc(doc);
  const oldW = doc.canvas.width;
  const oldH = doc.canvas.height;
  const size = CANVAS_SIZES[ratio];
  const factor = Math.min(size.width / oldW, size.height / oldH);
  const offsetX = (size.width - oldW * factor) / 2;
  const offsetY = (size.height - oldH * factor) / 2;

  next.ratio = ratio;
  next.canvas.width = size.width;
  next.canvas.height = size.height;
  next.elements = next.elements.map((element) => {
    const scaled: EditorElement = {
      ...element,
      x: offsetX + element.x * factor,
      y: offsetY + element.y * factor,
      width: Math.max(20, element.width * factor),
      height: Math.max(20, element.height * factor),
    };
    if (scaled.type === 'text') {
      scaled.fontSize = Math.max(10, scaled.fontSize * factor);
    }
    if (scaled.type === 'shape' && scaled.strokeWidth) {
      scaled.strokeWidth = Math.max(1, scaled.strokeWidth * factor);
    }
    return scaled;
  });
  return next;
}

export function updateImageElement(
  doc: EditorDoc,
  elementId: string,
  patch: Partial<ImageElement>,
): EditorDoc {
  return updateElement(doc, elementId, patch);
}

export function elementDisplayName(element: EditorElement): string {
  if (element.type === 'text') {
    return element.text.trim().slice(0, 12) || '文字';
  }
  if (element.type === 'image') {
    return element.assetId === 'source' ? '图片' : '图片';
  }
  const names: Record<string, string> = {
    rect: '矩形',
    line: '线条',
    ellipse: '圆形',
    frame: '边框',
    dot: '圆点',
  };
  return names[element.shape] ?? '装饰';
}
