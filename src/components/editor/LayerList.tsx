'use client';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Image as ImageIcon,
  Shapes,
  Trash2,
  Type,
} from 'lucide-react';
import type { EditorDoc, EditorElement } from '@/lib/editor/types';
import { elementDisplayName, type ReorderDirection } from '@/lib/editor/operations';
import { cn } from '@/lib/utils';

export function LayerList({
  doc,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
}: {
  doc: EditorDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (id: string, direction: ReorderDirection) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const elements = [...doc.elements].reverse();

  return (
    <div className="space-y-1.5">
      {elements.map((element, index) => {
        const selected = element.id === selectedId;
        const Icon =
          element.type === 'image'
            ? ImageIcon
            : element.type === 'text'
              ? Type
              : Shapes;
        return (
          <div
            key={element.id}
            className={cn(
              'group rounded-xl border px-2.5 py-2 transition-colors',
              selected
                ? 'border-sage-500 bg-sage-50'
                : 'border-line bg-paper/60 hover:border-ink/20',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(element.id)}
              className="flex w-full items-center gap-2 text-left"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-xs">
                {elementDisplayName(element)}
              </span>
              <span className="text-[10px] text-muted">
                {elements.length - index}
              </span>
            </button>
            {selected && (
              <div className="mt-2 flex items-center gap-1 border-t border-line pt-2">
                <LayerButton
                  label="上移一层"
                  onClick={() => onReorder(element.id, 'forward')}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </LayerButton>
                <LayerButton
                  label="下移一层"
                  onClick={() => onReorder(element.id, 'backward')}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </LayerButton>
                <LayerButton
                  label="复制"
                  onClick={() => onDuplicate(element.id)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </LayerButton>
                <LayerButton
                  label="删除"
                  onClick={() => onDelete(element.id)}
                  danger
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </LayerButton>
              </div>
            )}
          </div>
        );
      })}
      {elements.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-xs text-muted">
          画布还没有元素。
        </p>
      )}
    </div>
  );
}

function LayerButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted hover:bg-surface hover:text-ink',
        danger && 'text-clay hover:text-clay',
      )}
    >
      {children}
    </button>
  );
}
