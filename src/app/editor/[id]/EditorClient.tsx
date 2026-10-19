'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Redo2,
  Save,
  Undo2,
  X,
} from 'lucide-react';
import {
  getWork,
  updateWork,
  type AssetDto,
  type WorkDto,
} from '@/lib/client/api';
import type {
  CanvasRatio,
  EditorDoc,
  EditorElement,
  ImageElement,
  ShapeElement,
  ShapeKind,
  TemplateId,
  TextElement,
} from '@/lib/editor/types';
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
  type HistoryState,
} from '@/lib/editor/history';
import {
  addElement,
  createElementId,
  duplicateElement,
  removeElement,
  reorderElement,
  setCanvasRatio,
  updateElement,
  type ReorderDirection,
} from '@/lib/editor/operations';
import { createTemplateDoc } from '@/lib/editor/templates';
import {
  EditorCanvas,
  type EditorCanvasHandle,
} from '@/components/editor/EditorCanvas';
import {
  ToolPanel,
  TOOL_TABS,
  type TextKind,
  type ToolTab,
} from '@/components/editor/ToolPanel';
import { LayerList } from '@/components/editor/LayerList';
import { cn, downloadDataUrl, formatDate } from '@/lib/utils';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function firstImageAssetId(doc: EditorDoc): string | null {
  const element = doc.elements.find(
    (item): item is ImageElement => item.type === 'image',
  );
  return element?.assetId ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误';
}

export function EditorClient({ workId }: { workId: string }) {
  const [work, setWork] = useState<WorkDto | null>(null);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [title, setTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ToolTab>('template');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exporting, setExporting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<EditorCanvasHandle>(null);
  const lastSavedRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doc = history?.present ?? null;
  const selected =
    doc?.elements.find((element) => element.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWork(workId)
      .then((loaded) => {
        if (cancelled) return;
        setWork(loaded);
        setTitle(loaded.title);
        setHistory(createHistory(loaded.doc));
        lastSavedRef.current = JSON.stringify({
          title: loaded.title,
          doc: loaded.doc,
        });
        setSaveState('saved');
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workId]);

  useEffect(() => {
    if (!selectedId || !doc) return;
    if (!doc.elements.some((element) => element.id === selectedId)) {
      setSelectedId(null);
    }
  }, [doc, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileSheetOpen]);

  const applyDoc = useCallback((next: EditorDoc) => {
    setHistory((current) => (current ? commit(current, next) : current));
    setSaveState('idle');
  }, []);

  const saveNow = useCallback(
    async (override?: { doc?: EditorDoc; title?: string }) => {
      if (!work || !history) return;
      const docToSave = override?.doc ?? history.present;
      const titleToSave =
        (override?.title ?? title).trim() || '未命名作品';
      const signature = JSON.stringify({ title: titleToSave, doc: docToSave });
      if (signature === lastSavedRef.current) {
        setSaveState('saved');
        return;
      }

      setSaveState('saving');
      setSaveError(null);
      try {
        const updated = await updateWork(work.id, {
          title: titleToSave,
          doc: docToSave,
        });
        lastSavedRef.current = signature;
        setWork(updated);
        if (titleToSave !== title) setTitle(titleToSave);
        setSaveState('saved');
      } catch (error) {
        setSaveState('error');
        setSaveError(errorMessage(error));
        throw error;
      }
    },
    [work, history, title],
  );

  useEffect(() => {
    if (!work || !history) return;
    const titleToSave = title.trim() || '未命名作品';
    const signature = JSON.stringify({ title: titleToSave, doc: history.present });
    if (signature === lastSavedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, 2200);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [history, title, work, saveNow]);

  useEffect(() => {
    if (!work || !history) return;
    const handler = (event: BeforeUnloadEvent) => {
      const signature = JSON.stringify({
        title: title.trim() || '未命名作品',
        doc: history.present,
      });
      if (signature !== lastSavedRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [work, history, title]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const inInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setHistory((current) => {
          if (!current) return current;
          return event.shiftKey ? redo(current) : undo(current);
        });
        return;
      }
      if (
        !inInput &&
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedId
      ) {
        event.preventDefault();
        setHistory((current) => {
          if (!current) return current;
          const next = removeElement(current.present, selectedId);
          setSelectedId(null);
          return commit(current, next);
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  function handleTemplate(templateId: TemplateId) {
    if (!work || !doc) return;
    const resultAssetId =
      work.resultAsset?.id ?? firstImageAssetId(doc);
    if (!resultAssetId) {
      setToast('作品缺少生成图片，无法套用模板。');
      return;
    }
    if (
      doc.elements.length > 0 &&
      !window.confirm('切换模板会替换当前画布内容，是否继续？')
    ) {
      return;
    }
    const next = createTemplateDoc(templateId, {
      sourceAssetId: work.sourceAsset?.id,
      resultAssetId,
      title: title.trim() || '未命名作品',
      date: formatDate(new Date()),
    });
    setHistory(createHistory(next));
    setSelectedId(null);
    setTab('template');
    setMobileSheetOpen(false);
    setSaveState('idle');
  }

  function handleRatio(ratio: CanvasRatio) {
    if (!doc || doc.ratio === ratio) return;
    applyDoc(setCanvasRatio(doc, ratio));
    setToast('画布比例已调整，元素已按比例缩放。');
  }

  function handleAddImage(assetId: string) {
    if (!doc || !work) return;
    const asset =
      work.sourceAsset?.id === assetId
        ? work.sourceAsset
        : work.resultAsset?.id === assetId
          ? work.resultAsset
          : null;
    if (!asset) return;

    const maxWidth = doc.canvas.width * 0.55;
    const maxHeight = doc.canvas.height * 0.55;
    const scale = Math.min(
      maxWidth / asset.width,
      maxHeight / asset.height,
    );
    const width = Math.max(80, asset.width * scale);
    const height = Math.max(80, asset.height * scale);
    const element: ImageElement = {
      id: createElementId('image'),
      type: 'image',
      assetId,
      x: (doc.canvas.width - width) / 2,
      y: (doc.canvas.height - height) / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      fit: 'cover',
      cornerRadius: 2,
    };
    applyDoc(addElement(doc, element));
    setSelectedId(element.id);
    setTab('image');
    setMobileSheetOpen(false);
  }

  function handleAddText(kind: TextKind) {
    if (!doc) return;
    const canvas = doc.canvas;
    const defaults: Record<
      TextKind,
      { text: string; fontSize: number; width: number; height: number; y: number; family: TextElement['fontFamily']; fill: string }
    > = {
      title: {
        text: '在这里写下标题',
        fontSize: 76,
        width: canvas.width - 200,
        height: 110,
        y: canvas.height * 0.68,
        family: 'serif',
        fill: '#2B2A27',
      },
      subtitle: {
        text: '一句简短的说明',
        fontSize: 32,
        width: canvas.width - 200,
        height: 60,
        y: canvas.height * 0.78,
        family: 'sans',
        fill: '#6F6A60',
      },
      date: {
        text: formatDate(new Date()),
        fontSize: 28,
        width: 520,
        height: 44,
        y: canvas.height * 0.86,
        family: 'sans',
        fill: '#6F6A60',
      },
    };
    const item = defaults[kind];
    const element: TextElement = {
      id: createElementId('text'),
      type: 'text',
      text: item.text,
      x: 100,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: 0,
      opacity: 1,
      fontFamily: item.family,
      fontSize: item.fontSize,
      fontStyle: kind === 'title' ? 'normal' : 'normal',
      fill: item.fill,
      align: 'left',
      lineHeight: 1.25,
      letterSpacing: 0,
    };
    applyDoc(addElement(doc, element));
    setSelectedId(element.id);
    setTab('text');
    setMobileSheetOpen(false);
  }

  function handleAddShape(shape: ShapeKind) {
    if (!doc) return;
    const canvas = doc.canvas;
    const base = {
      id: createElementId('shape'),
      type: 'shape' as const,
      shape: 'line' as const,
      x: canvas.width * 0.25,
      y: canvas.height * 0.45,
      width: canvas.width * 0.5,
      height: 2,
      rotation: 0,
      opacity: 1,
      stroke: '#6F6A60',
      strokeWidth: 2,
    };
    let element: ShapeElement = base;
    if (shape === 'frame') {
      element = {
        ...base,
        shape: 'frame',
        x: canvas.width * 0.1,
        y: canvas.height * 0.1,
        width: canvas.width * 0.8,
        height: canvas.height * 0.6,
        stroke: '#D9D0C2',
        strokeWidth: 3,
      };
    } else if (shape === 'dot') {
      element = {
        ...base,
        shape: 'dot',
        x: canvas.width * 0.44,
        y: canvas.height * 0.44,
        width: 120,
        height: 120,
        fill: '#C77D6A',
        stroke: undefined,
        strokeWidth: 0,
      };
    } else if (shape === 'rect') {
      element = {
        ...base,
        shape: 'rect',
        width: canvas.width * 0.36,
        height: canvas.height * 0.22,
        fill: 'transparent',
      };
    } else if (shape === 'ellipse') {
      element = {
        ...base,
        shape: 'ellipse',
        x: canvas.width * 0.35,
        y: canvas.height * 0.35,
        width: canvas.width * 0.3,
        height: canvas.width * 0.3,
        fill: 'transparent',
      };
    } else {
      element = { ...base, shape: 'line' };
    }
    applyDoc(addElement(doc, element));
    setSelectedId(element.id);
    setTab('decor');
    setMobileSheetOpen(false);
  }

  function handleDelete(id: string) {
    if (!doc) return;
    applyDoc(removeElement(doc, id));
    setSelectedId(null);
  }

  function handleDuplicate(id: string) {
    if (!doc) return;
    const result = duplicateElement(doc, id);
    applyDoc(result.doc);
    setSelectedId(result.newId);
  }

  function handleReorder(id: string, direction: ReorderDirection) {
    if (!doc) return;
    applyDoc(reorderElement(doc, id, direction));
  }

  function handleUndo() {
    setHistory((current) => (current ? undo(current) : current));
    setSaveState('idle');
  }

  function handleRedo() {
    setHistory((current) => (current ? redo(current) : current));
    setSaveState('idle');
  }

  async function handleSave() {
    try {
      await saveNow();
      setToast('作品已保存。');
    } catch {
      setToast('保存失败，请重试。');
    }
  }

  async function handleExport() {
    if (!doc || !canvasRef.current || exporting) return;
    setExporting(true);
    setSaveError(null);
    try {
      try {
        await saveNow();
      } catch {
        // 保存失败不阻止本地导出，但会在状态栏提示。
      }

      const safeTitle =
        (title.trim() || 'handdrawn').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      const targetWidth = doc.canvas.width * 2;
      const dataUrl = await canvasRef.current.exportDataUrl({
        targetWidth,
        mimeType: exportFormat === 'png' ? 'image/png' : 'image/jpeg',
        quality: 0.92,
      });
      downloadDataUrl(
        dataUrl,
        `${safeTitle}.${exportFormat === 'png' ? 'png' : 'jpg'}`,
      );
      const height = Math.round(
        (targetWidth * doc.canvas.height) / doc.canvas.width,
      );
      setToast(
        `已导出 ${targetWidth} × ${height}px ${exportFormat.toUpperCase()}。`,
      );
    } catch (error) {
      setSaveError(errorMessage(error));
      setToast('导出失败，请重试。');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        正在打开作品…
      </div>
    );
  }

  if (loadError || !work || !history || !doc) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-clay" aria-hidden="true" />
        <h1 className="mt-4 font-serif text-2xl">无法打开作品</h1>
        <p className="mt-2 text-sm text-muted">
          {loadError ?? '作品不存在，可能已被删除。'}
        </p>
        <Link
          href="/works"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm text-paper"
        >
          返回作品集
        </Link>
      </div>
    );
  }

  const exportWidth = doc.canvas.width * 2;
  const exportHeight = doc.canvas.height * 2;

  const panel = (
    <ToolPanel
      doc={doc}
      selected={selected}
      activeTab={tab}
      onTabChange={(nextTab) => {
        setTab(nextTab);
        if (!mobileSheetOpen) setMobileSheetOpen(true);
      }}
      onApply={applyDoc}
      onTemplate={handleTemplate}
      onRatio={handleRatio}
      onAddImage={handleAddImage}
      onAddText={handleAddText}
      onAddShape={handleAddShape}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
      onReorder={handleReorder}
      onSelect={setSelectedId}
      sourceAsset={work.sourceAsset}
      resultAsset={work.resultAsset}
    />
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-3 py-2.5 sm:px-5">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
          {previewMode ? (
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs text-muted hover:text-ink"
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              退出预览
            </button>
          ) : (
            <>
              <Link
                href="/works"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 text-xs text-muted hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                作品集
              </Link>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaveState('idle');
                }}
                onBlur={() => void saveNow()}
                maxLength={80}
                aria-label="作品标题"
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-serif text-lg outline-none hover:border-line focus:border-sage-500 sm:max-w-[360px]"
              />
            </>
          )}
        </div>

        <div className="flex w-full items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
          <span
            className={cn(
              'hidden rounded-full px-2.5 py-1 text-[10px] sm:inline-flex',
              saveState === 'saved' && 'bg-sage-50 text-sage-700',
              saveState === 'idle' && 'bg-paper text-muted',
              saveState === 'saving' && 'bg-paper text-muted',
              saveState === 'error' && 'bg-clay/10 text-clay',
            )}
          >
            {saveState === 'saved' && '已保存'}
            {saveState === 'idle' && '有未保存修改'}
            {saveState === 'saving' && '保存中…'}
            {saveState === 'error' && '保存失败'}
          </span>

          {!previewMode && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo(history)}
                aria-label="撤销"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink disabled:opacity-35"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo(history)}
                aria-label="重做"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink disabled:opacity-35"
              >
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                aria-label="预览"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-muted hover:text-ink"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">预览</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                aria-label="保存"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-muted hover:text-ink"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">保存</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs text-paper hover:bg-sage-700 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {exporting ? '导出中…' : '导出'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 border-b border-clay/20 bg-clay/5 px-4 py-2 text-xs text-clay">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      )}

      {work.isMock && !previewMode && (
        <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          当前作品包含程序化演示图，不是 AI 生成结果。配置真实 `ARK_API_KEY` 后重新生成即可。
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!previewMode && (
          <aside className="hidden w-[290px] shrink-0 overflow-y-auto border-r border-line bg-canvas p-3 lg:block">
            {panel}
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              'flex-1 p-3 sm:p-5',
              !previewMode && 'pb-24 lg:pb-5',
            )}
          >
            <div
              className={cn(
                'mx-auto w-full rounded-xl border border-line bg-[#e9e4da]/50 p-2',
                previewMode
                  ? 'h-[calc(100vh-150px)] min-h-[360px]'
                  : 'h-[52vh] min-h-[320px] lg:h-[calc(100vh-220px)]',
              )}
            >
              <EditorCanvas
                ref={canvasRef}
                doc={doc}
                selectedId={selectedId}
                previewMode={previewMode}
                onSelect={setSelectedId}
                onCommit={applyDoc}
              />
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-muted">
              画布按设计尺寸缩放显示；导出时使用同一 Konva 画布按 2× 像素比原生渲染，
              不是把屏幕预览图放大。选中元素后可拖动、缩放、旋转。
            </p>
          </div>
        </section>

        {!previewMode && (
          <aside className="hidden w-[290px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-canvas p-3 xl:block">
            <section className="rounded-xl border border-line bg-surface p-3">
              <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted">
                图层
              </h2>
              <LayerList
                doc={doc}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={handleReorder}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </section>

            <section className="rounded-xl border border-line bg-surface p-3">
              <h2 className="text-[11px] font-medium tracking-wide text-muted">
                导出
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(['png', 'jpeg'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setExportFormat(format)}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-[11px]',
                      exportFormat === format
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line text-muted',
                    )}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted">
                输出尺寸：{exportWidth} × {exportHeight}px。
                PNG 适合文字与排版，JPEG 文件更小。
              </p>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-xs text-paper hover:bg-sage-700 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {exporting ? '正在渲染…' : '下载成品'}
              </button>
              <p className="mt-2 text-[10px] leading-4 text-muted">
                导出前会自动保存。若图片未加载完成，会等待并提示，而不是导出空白画布。
              </p>
            </section>
          </aside>
        )}
      </div>

      {!previewMode && (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas px-2 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
          <div className="grid grid-cols-6 gap-1">
            {TOOL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setMobileSheetOpen(true);
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px]',
                  tab === item.id ? 'text-ink' : 'text-muted',
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {mobileSheetOpen && !previewMode && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSheetOpen(false)}
            className="absolute inset-0 bg-ink/30"
            aria-label="关闭工具面板"
          />
          <div
            data-testid="mobile-tool-sheet"
            className="absolute inset-x-0 bottom-[58px] max-h-[58vh] overflow-y-auto rounded-t-2xl border-t border-line bg-canvas p-4 pb-6 shadow-lift"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg">编辑工具</h2>
              <button
                type="button"
                data-testid="close-mobile-tool-sheet"
                onClick={() => setMobileSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-muted"
                aria-label="关闭"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs text-paper shadow-lift lg:bottom-6">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {toast}
          </span>
        </div>
      )}

      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35">
          <div className="rounded-2xl bg-surface px-6 py-5 text-center shadow-lift">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-sage-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">正在渲染高清图片…</p>
            <p className="mt-1 text-xs text-muted">
              等待图片与字体加载完成后导出，请稍候。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
