'use client';

import { useState } from 'react';

export function CompareSlider({
  originalUrl,
  resultUrl,
  originalLabel = '原始照片',
  resultLabel = '手绘作品',
}: {
  originalUrl: string;
  resultUrl: string;
  originalLabel?: string;
  resultLabel?: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink/5">
      <div className="relative aspect-[4/3] w-full select-none overflow-hidden bg-[#e9e4da]">
        <img
          src={resultUrl}
          alt={resultLabel}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={originalUrl}
            alt={originalLabel}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-paper shadow-[0_0_0_1px_rgba(43,42,39,0.15)]"
          style={{ left: `${position}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink/20 bg-paper shadow-soft">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 4L2.5 8L6 12M10 4L13.5 8L10 12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper">
          {originalLabel}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-paper">
          {resultLabel}
        </span>

        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="compare-range absolute inset-0 z-10 h-full w-full opacity-0"
          aria-label="拖动比较原图与手绘结果"
        />
      </div>
      <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted">
        <span>拖动滑块比较</span>
        <span>左：原图 · 右：手绘</span>
      </div>
    </div>
  );
}
