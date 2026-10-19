import { describe, expect, it } from 'vitest';
import {
  addElement,
  duplicateElement,
  removeElement,
  reorderElement,
  setCanvasRatio,
  updateElement,
} from '@/lib/editor/operations';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
} from '@/lib/editor/history';
import { createTemplateDoc } from '@/lib/editor/templates';
import { parseEditorDoc } from '@/lib/editor/validation';
import type {
  EditorDoc,
  TemplateId,
  TextElement,
} from '@/lib/editor/types';

const templateIds: TemplateId[] = [
  'single-poster',
  'vertical-compare',
  'side-by-side',
  'free-collage',
];

function titleElement(doc: EditorDoc): TextElement {
  const element = doc.elements.find(
    (item): item is TextElement => item.type === 'text',
  );
  if (!element) throw new Error('template should contain text');
  return element;
}

describe('editor templates and operations', () => {
  it.each(templateIds)('creates a valid %s document', (templateId) => {
    const doc = createTemplateDoc(templateId, {
      sourceAssetId: 'source-asset-1234',
      resultAssetId: 'result-asset-5678',
      title: '测试作品',
      date: '2026年10月18日',
    });
    const parsed = parseEditorDoc(doc);
    expect(parsed.elements.length).toBeGreaterThan(0);
    expect(parsed.elements.some((item) => item.type === 'image')).toBe(true);
    expect(parsed.elements.some((item) => item.type === 'text')).toBe(true);
  });

  it('updates, reorders, duplicates and removes elements', () => {
    let doc = createTemplateDoc('single-poster', {
      resultAssetId: 'result-asset-5678',
      title: '标题',
    });
    const title = titleElement(doc);
    doc = updateElement(doc, title.id, { text: '新的标题' });
    expect(titleElement(doc).text).toBe('新的标题');

    const before = doc.elements.findIndex((item) => item.id === title.id);
    doc = reorderElement(doc, title.id, 'front');
    expect(doc.elements[doc.elements.length - 1].id).toBe(title.id);

    const duplicated = duplicateElement(doc, title.id);
    expect(duplicated.doc.elements.length).toBe(doc.elements.length + 1);
    expect(duplicated.newId).not.toBe(title.id);

    doc = removeElement(duplicated.doc, duplicated.newId);
    expect(doc.elements.some((item) => item.id === duplicated.newId)).toBe(false);
  });

  it('scales elements when switching canvas ratio', () => {
    const doc = createTemplateDoc('single-poster', {
      resultAssetId: 'result-asset-5678',
      title: '标题',
    });
    const next = setCanvasRatio(doc, '1:1');
    expect(next.canvas.width).toBe(1400);
    expect(next.canvas.height).toBe(1400);
    expect(parseEditorDoc(next).ratio).toBe('1:1');
  });

  it('supports undo and redo history', () => {
    const doc = createTemplateDoc('single-poster', {
      resultAssetId: 'result-asset-5678',
      title: '标题',
    });
    const title = titleElement(doc);
    const changed = updateElement(doc, title.id, { text: '修改后' });

    let history = createHistory(doc);
    expect(canUndo(history)).toBe(false);
    history = commit(history, changed);
    expect(canUndo(history)).toBe(true);
    expect(titleElement(history.present).text).toBe('修改后');

    history = undo(history);
    expect(titleElement(history.present).text).toBe(title.text);
    expect(canRedo(history)).toBe(true);

    history = redo(history);
    expect(titleElement(history.present).text).toBe('修改后');
  });

  it('rejects duplicate element ids', () => {
    const doc = createTemplateDoc('single-poster', {
      resultAssetId: 'result-asset-5678',
      title: '标题',
    });
    const element = doc.elements[0];
    expect(() => addElement(doc, element)).toThrow(/ID 重复/);
  });
});
