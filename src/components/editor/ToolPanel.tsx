'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Palette,
  Shapes,
  SlidersHorizontal,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AssetDto } from '@/lib/client/api';
import type {
  CanvasRatio,
  EditorDoc,
  EditorElement,
  ShapeKind,
  TemplateId,
  TextElement,
} from '@/lib/editor/types';
import { TEMPLATE_PRESETS } from '@/lib/editor/types';
import { reorderElement, updateElement } from '@/lib/editor/operations';
import type { ReorderDirection } from '@/lib/editor/operations';
import { cn } from '@/lib/utils';
import { LayerList } from './LayerList';

export type ToolTab =
  | 'template'
  | 'canvas'
  | 'image'
  | 'text'
  | 'decor'
  | 'layers';

export type TextKind = 'title' | 'subtitle' | 'date';

export const TOOL_TABS: Array<{ id: ToolTab; label: string; icon: typeof Type }> = [
  { id: 'template', label: '模板', icon: LayoutTemplate },
  { id: 'canvas', label: '画布', icon: SlidersHorizontal },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'text', label: '文字', icon: Type },
  { id: 'decor', label: '装饰', icon: Shapes },
  { id: 'layers', label: '图层', icon: Layers },
];

const BACKGROUNDS = [
  '#FBF8F1',
  '#F4EFE4',
  '#FFFFFF',
  '#EEF1EA',
  '#F3E7DE',
  '#E8EDF0',
  '#2B2A27',
];

const TEXT_COLORS = ['#2B2A27', '#5D6B4D', '#B9765A', '#6F6A60', '#FFFFFF'];

export function ToolPanel({
  doc,
  selected,
  activeTab,
  onTabChange,
  onApply,
  onTemplate,
  onRatio,
  onAddImage,
  onAddText,
  onAddShape,
  onDelete,
  onDuplicate,
  onReorder,
  onSelect,
  sourceAsset,
  resultAsset,
}: {
  doc: EditorDoc;
  selected: EditorElement | null;
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
  onApply: (next: EditorDoc) => void;
  onTemplate: (id: TemplateId) => void;
  onRatio: (ratio: CanvasRatio) => void;
  onAddImage: (assetId: string) => void;
  onAddText: (kind: TextKind) => void;
  onAddShape: (shape: ShapeKind) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, direction: ReorderDirection) => void;
  onSelect: (id: string | null) => void;
  sourceAsset: AssetDto | null;
  resultAsset: AssetDto | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition-colors',
              activeTab === tab.id
                ? 'border-ink bg-ink text-paper'
                : 'border-line bg-paper text-muted hover:text-ink',
            )}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'template' && (
        <Section title="布局模板">
          <div className="space-y-2">
            {TEMPLATE_PRESETS.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onTemplate(template.id)}
                className="w-full rounded-xl border border-line bg-paper/70 px-3 py-2.5 text-left transition-colors hover:border-ink/25 hover:bg-surface"
              >
                <span className="text-xs font-medium">{template.name}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted">
            切换模板会替换当前画布内容；需要保留时请先导出图片。
          </p>
        </Section>
      )}

      {activeTab === 'canvas' && (
        <>
          <Section title="画布比例">
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['3:4', '纵向'],
                  ['4:3', '横向'],
                  ['1:1', '方形'],
                ] as Array<[CanvasRatio, string]>
              ).map(([ratio, label]) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onRatio(ratio)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs',
                    doc.ratio === ratio
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-paper text-muted hover:text-ink',
                  )}
                >
                  <span className="block font-medium">{ratio}</span>
                  <span className="text-[10px] opacity-70">{label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted">
              {doc.canvas.width} × {doc.canvas.height}px · 导出时按 2× 渲染
            </p>
          </Section>

          <Section title="背景">
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`背景颜色 ${color}`}
                  onClick={() =>
                    onApply({
                      ...doc,
                      canvas: { ...doc.canvas, background: color },
                    })
                  }
                  className={cn(
                    'h-7 w-7 rounded-full border',
                    doc.canvas.background === color
                      ? 'border-ink ring-2 ring-sage-500/40'
                      : 'border-line',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-muted">
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                <input
                  type="color"
                  value={doc.canvas.background}
                  onChange={(event) =>
                    onApply({
                      ...doc,
                      canvas: {
                        ...doc.canvas,
                        background: event.target.value,
                      },
                    })
                  }
                  className="sr-only"
                  aria-label="自定义背景颜色"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-paper/70 px-3 py-2">
              <span className="text-xs text-muted">纸张颗粒</span>
              <div className="flex gap-1">
                {(['none', 'paper'] as const).map((texture) => (
                  <button
                    key={texture}
                    type="button"
                    onClick={() =>
                      onApply({
                        ...doc,
                        canvas: { ...doc.canvas, texture },
                      })
                    }
                    className={cn(
                      'rounded-md px-2 py-1 text-[10px]',
                      doc.canvas.texture === texture
                        ? 'bg-ink text-paper'
                        : 'border border-line text-muted',
                    )}
                  >
                    {texture === 'none' ? '关闭' : '柔和'}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </>
      )}

      {activeTab === 'image' && (
        <>
          <Section title="添加图片">
            <div className="grid grid-cols-2 gap-2">
              <AssetButton
                label="原始照片"
                asset={sourceAsset}
                onAdd={onAddImage}
              />
              <AssetButton
                label="手绘结果"
                asset={resultAsset}
                onAdd={onAddImage}
              />
            </div>
          </Section>

          {selected?.type === 'image' ? (
            <Section title="图片属性">
              <div className="flex gap-1.5">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() =>
                      onApply(
                        updateElement(doc, selected.id, { fit }),
                      )
                    }
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1.5 text-[11px]',
                      selected.fit === fit
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line text-muted',
                    )}
                  >
                    {fit === 'cover' ? '填满裁剪' : '完整显示'}
                  </button>
                ))}
              </div>
              <RangeField
                label="圆角"
                value={selected.cornerRadius}
                min={0}
                max={120}
                step={1}
                onChange={(value) =>
                  onApply(
                    updateElement(doc, selected.id, { cornerRadius: value }),
                  )
                }
              />
              <RangeField
                label="透明度"
                value={selected.opacity}
                min={0.1}
                max={1}
                step={0.01}
                onChange={(value) =>
                  onApply(updateElement(doc, selected.id, { opacity: value }))
                }
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">描边</span>
                <button
                  type="button"
                  onClick={() =>
                    onApply(
                      updateElement(doc, selected.id, {
                        stroke: selected.stroke ? undefined : '#2B2A27',
                        strokeWidth: selected.stroke ? undefined : 3,
                      }),
                    )
                  }
                  className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-ink"
                >
                  {selected.stroke ? '移除描边' : '添加细描边'}
                </button>
              </div>
            </Section>
          ) : (
            <Hint text="在画布或图层中选择一张图片，可调整填满方式、圆角、描边与透明度。" />
          )}
        </>
      )}

      {activeTab === 'text' && (
        <>
          <Section title="添加文字">
            <div className="grid grid-cols-3 gap-1.5">
              <SmallButton onClick={() => onAddText('title')}>标题</SmallButton>
              <SmallButton onClick={() => onAddText('subtitle')}>
                副标题
              </SmallButton>
              <SmallButton onClick={() => onAddText('date')}>日期</SmallButton>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted">
              文字由 Canvas 独立绘制，不交给 AI 生成，避免中文错字。
            </p>
          </Section>

          {selected?.type === 'text' ? (
            <TextProperties doc={doc} element={selected} onApply={onApply} />
          ) : (
            <Hint text="添加文字后，在画布或图层中选中它，即可编辑内容、字体、字号、颜色与对齐。" />
          )}
        </>
      )}

      {activeTab === 'decor' && (
        <>
          <Section title="添加装饰">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['line', '细线'],
                  ['frame', '边框'],
                  ['dot', '圆点'],
                  ['rect', '矩形'],
                  ['ellipse', '圆形'],
                ] as Array<[ShapeKind, string]>
              ).map(([shape, label]) => (
                <SmallButton key={shape} onClick={() => onAddShape(shape)}>
                  {label}
                </SmallButton>
              ))}
            </div>
          </Section>

          {selected?.type === 'shape' ? (
            <Section title="装饰属性">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">填充</span>
                <input
                  type="color"
                  value={selected.fill && selected.fill.startsWith('#') ? selected.fill : '#B9765A'}
                  onChange={(event) =>
                    onApply(
                      updateElement(doc, selected.id, { fill: event.target.value }),
                    )
                  }
                  className="h-7 w-12 cursor-pointer rounded border border-line bg-surface"
                  aria-label="装饰填充颜色"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">描边</span>
                <input
                  type="color"
                  value={selected.stroke && selected.stroke.startsWith('#') ? selected.stroke : '#2B2A27'}
                  onChange={(event) =>
                    onApply(
                      updateElement(doc, selected.id, {
                        stroke: event.target.value,
                      }),
                    )
                  }
                  className="h-7 w-12 cursor-pointer rounded border border-line bg-surface"
                  aria-label="装饰描边颜色"
                />
              </div>
              <RangeField
                label="描边宽度"
                value={selected.strokeWidth ?? 2}
                min={0}
                max={24}
                step={1}
                onChange={(value) =>
                  onApply(
                    updateElement(doc, selected.id, { strokeWidth: value }),
                  )
                }
              />
              <RangeField
                label="透明度"
                value={selected.opacity}
                min={0.1}
                max={1}
                step={0.01}
                onChange={(value) =>
                  onApply(updateElement(doc, selected.id, { opacity: value }))
                }
              />
            </Section>
          ) : (
            <Hint text="装饰元素用于留白、分隔线和边框；选中后可调整颜色与粗细。" />
          )}
        </>
      )}

      {activeTab === 'layers' && (
        <Section title="图层顺序">
          <LayerList
            doc={doc}
            selectedId={selected?.id ?? null}
            onSelect={onSelect}
            onReorder={onReorder}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </Section>
      )}

      {selected && activeTab !== 'layers' && (
        <div className="flex items-center gap-1.5 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => onReorder(selected.id, 'front')}
            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line text-[10px] text-muted hover:text-ink"
          >
            <ArrowUpToLine className="h-3 w-3" aria-hidden="true" />
            置顶
          </button>
          <button
            type="button"
            onClick={() => onReorder(selected.id, 'back')}
            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line text-[10px] text-muted hover:text-ink"
          >
            <ArrowDownToLine className="h-3 w-3" aria-hidden="true" />
            置底
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(selected.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
            aria-label="复制元素"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(selected.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-clay"
            aria-label="删除元素"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-3 py-4 text-[11px] leading-5 text-muted">
      {text}
    </p>
  );
}

function SmallButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-line bg-paper px-2 py-2 text-[11px] text-muted transition-colors hover:border-ink/20 hover:text-ink"
    >
      {children}
    </button>
  );
}

function AssetButton({
  label,
  asset,
  onAdd,
}: {
  label: string;
  asset: AssetDto | null;
  onAdd: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={!asset}
      onClick={() => asset && onAdd(asset.id)}
      className="overflow-hidden rounded-lg border border-line bg-paper text-left disabled:cursor-not-allowed disabled:opacity-45"
    >
      {asset ? (
        <img
          src={asset.url}
          alt={label}
          className="h-16 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-16 items-center justify-center bg-line/30 text-[10px] text-muted">
          无
        </div>
      )}
      <span className="block px-2 py-1.5 text-[10px] text-muted">{label}</span>
    </button>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full accent-sage-600"
      />
      <span className="w-9 text-right text-[10px]">{value}</span>
    </label>
  );
}

function TextProperties({
  doc,
  element,
  onApply,
}: {
  doc: EditorDoc;
  element: TextElement;
  onApply: (next: EditorDoc) => void;
}) {
  const [text, setText] = useState(element.text);

  useEffect(() => {
    setText(element.text);
  }, [element.id, element.text]);

  function commitText() {
    const value = text.trim();
    if (value && value !== element.text) {
      onApply(updateElement(doc, element.id, { text: value }));
    }
  }

  return (
    <Section title="文字属性">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commitText}
        rows={3}
        className="w-full resize-none rounded-lg border border-line bg-paper px-2.5 py-2 text-xs leading-5 outline-none focus:border-sage-500"
        placeholder="输入文字内容"
      />
      <div className="mt-2 flex gap-1">
        {(
          [
            ['sans', '黑体'],
            ['serif', '宋体'],
            ['kai', '楷体'],
          ] as Array<[TextElement['fontFamily'], string]>
        ).map(([family, label]) => (
          <button
            key={family}
            type="button"
            onClick={() =>
              onApply(updateElement(doc, element.id, { fontFamily: family }))
            }
            className={cn(
              'flex-1 rounded-md border px-2 py-1.5 text-[10px]',
              element.fontFamily === family
                ? 'border-ink bg-ink text-paper'
                : 'border-line text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
        <span className="w-14">字号</span>
        <input
          type="range"
          min={10}
          max={200}
          step={1}
          value={element.fontSize}
          onChange={(event) =>
            onApply(
              updateElement(doc, element.id, {
                fontSize: Number(event.target.value),
              }),
            )
          }
          className="h-1.5 w-full accent-sage-600"
        />
        <input
          type="number"
          min={10}
          max={200}
          value={element.fontSize}
          onChange={(event) =>
            onApply(
              updateElement(doc, element.id, {
                fontSize: Math.max(10, Number(event.target.value) || 10),
              }),
            )
          }
          className="w-12 rounded border border-line bg-paper px-1 py-0.5 text-right text-[10px]"
          aria-label="字号"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">颜色</span>
        <div className="flex items-center gap-1.5">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() =>
                onApply(updateElement(doc, element.id, { fill: color }))
              }
              className={cn(
                'h-5 w-5 rounded-full border',
                element.fill === color ? 'border-ink ring-1 ring-sage-500' : 'border-line',
              )}
              style={{ backgroundColor: color }}
              aria-label={`文字颜色 ${color}`}
            />
          ))}
          <input
            type="color"
            value={element.fill.startsWith('#') ? element.fill : '#2B2A27'}
            onChange={(event) =>
              onApply(
                updateElement(doc, element.id, { fill: event.target.value }),
              )
            }
            className="h-6 w-8 cursor-pointer rounded border border-line bg-surface"
            aria-label="自定义文字颜色"
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">对齐</span>
        <div className="flex gap-1">
          {(
            [
              ['left', AlignLeft],
              ['center', AlignCenter],
              ['right', AlignRight],
            ] as Array<[TextElement['align'], typeof AlignLeft]>
          ).map(([align, Icon]) => (
            <button
              key={align}
              type="button"
              onClick={() =>
                onApply(updateElement(doc, element.id, { align }))
              }
              className={cn(
                'flex h-7 w-8 items-center justify-center rounded-md border',
                element.align === align
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line text-muted',
              )}
              aria-label={`文字${align}对齐`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <RangeField
        label="行距"
        value={element.lineHeight}
        min={0.9}
        max={2.4}
        step={0.05}
        onChange={(value) =>
          onApply(updateElement(doc, element.id, { lineHeight: value }))
        }
      />
      <RangeField
        label="字间距"
        value={element.letterSpacing}
        min={-2}
        max={20}
        step={0.5}
        onChange={(value) =>
          onApply(updateElement(doc, element.id, { letterSpacing: value }))
        }
      />
      <RangeField
        label="透明度"
        value={element.opacity}
        min={0.1}
        max={1}
        step={0.01}
        onChange={(value) =>
          onApply(updateElement(doc, element.id, { opacity: value }))
        }
      />
    </Section>
  );
}
