'use client';

import { useId } from 'react';
import type { StyleId } from '@/lib/ai/types';
import { cn } from '@/lib/utils';

/**
 * 纯 SVG 的风格示意，不是 AI 生成结果。
 * 首页和风格卡必须同时标注“风格示意”，避免让用户误以为是示例作品。
 */
export function StylePreview({
  styleId,
  className,
  label = '风格示意',
}: {
  styleId: StyleId;
  className?: string;
  label?: string;
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `${id}-clip`;
  const blurId = `${id}-blur`;
  const grainId = `${id}-grain`;
  const hatchId = `${id}-hatch`;
  const crossId = `${id}-cross`;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <svg
        viewBox="0 0 400 300"
        className="h-full w-full"
        role="img"
        aria-label={`${label}：${styleId}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <clipPath id={clipId}>
            <rect width="400" height="300" rx="18" />
          </clipPath>
          <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id={grainId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="7"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.11" />
            </feComponentTransfer>
          </filter>
          <pattern
            id={hatchId}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <path
              d="M0 0V7"
              stroke="#4A4540"
              strokeWidth="0.9"
              opacity="0.34"
            />
          </pattern>
          <pattern
            id={crossId}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0L10 10M10 0L0 10"
              stroke="#2F2D29"
              strokeWidth="0.8"
              opacity="0.28"
            />
          </pattern>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {styleId === 'watercolor' && (
            <>
              <rect width="400" height="300" fill="#FBF7EE" />
              <ellipse
                cx="118"
                cy="112"
                rx="116"
                ry="84"
                fill="#9DB7AE"
                opacity="0.7"
                filter={`url(#${blurId})`}
              />
              <ellipse
                cx="264"
                cy="160"
                rx="120"
                ry="72"
                fill="#D9A18A"
                opacity="0.52"
                filter={`url(#${blurId})`}
              />
              <ellipse
                cx="208"
                cy="228"
                rx="150"
                ry="58"
                fill="#7E9A8C"
                opacity="0.35"
                filter={`url(#${blurId})`}
              />
              <path
                d="M62 214c48-38 78-30 118-9 32 17 63 16 112-14"
                stroke="#5D6B63"
                strokeWidth="1.4"
                fill="none"
                opacity="0.42"
              />
              <path
                d="M86 236c42-20 81-19 112-4 39 19 70 17 108-7"
                stroke="#5D6B63"
                strokeWidth="1"
                fill="none"
                opacity="0.26"
              />
              <circle cx="286" cy="82" r="27" fill="#F3D8B8" opacity="0.72" />
              <rect
                width="400"
                height="300"
                filter={`url(#${grainId})`}
                opacity="0.55"
              />
            </>
          )}

          {styleId === 'colored-pencil' && (
            <>
              <rect width="400" height="300" fill="#FBF7EE" />
              <path
                d="M0 216C62 186 108 196 158 214c53 19 103 16 242-28v114H0Z"
                fill="#C9B79A"
                opacity="0.72"
              />
              <path
                d="M0 248c88-34 150-26 210-6 64 21 124 8 190-22v80H0Z"
                fill="#A8B49D"
                opacity="0.58"
              />
              <circle cx="288" cy="84" r="31" fill="#D9A18A" opacity="0.62" />
              <path
                d="M72 210c36-46 70-60 106-46 28 11 47 37 72 44"
                stroke="#4A4540"
                strokeWidth="1.5"
                fill="none"
                opacity="0.55"
              />
              <path
                d="M128 232c30-18 60-20 96-5"
                stroke="#4A4540"
                strokeWidth="1.1"
                fill="none"
                opacity="0.4"
              />
              <path
                d="M252 128c22-18 44-22 68-10"
                stroke="#4A4540"
                strokeWidth="1"
                fill="none"
                opacity="0.32"
              />
              <rect width="400" height="300" fill={`url(#${hatchId})`} />
              <rect
                width="400"
                height="300"
                filter={`url(#${grainId})`}
                opacity="0.6"
              />
            </>
          )}

          {styleId === 'pen-sketch' && (
            <>
              <rect width="400" height="300" fill="#FBF7EE" />
              <circle
                cx="292"
                cy="78"
                r="30"
                fill="none"
                stroke="#2F2D29"
                strokeWidth="1.4"
                opacity="0.65"
              />
              <path
                d="M0 208c54-36 96-42 144-22 44 18 76 18 120-8 46-27 88-22 136 2"
                fill="none"
                stroke="#2F2D29"
                strokeWidth="1.6"
                opacity="0.72"
              />
              <path
                d="M0 232c58-26 102-28 150-12 52 17 92 14 132-4 40-18 76-16 118 4"
                fill="none"
                stroke="#2F2D29"
                strokeWidth="1.2"
                opacity="0.5"
              />
              <path
                d="M0 252c76-20 132-18 190-2 58 16 128 10 210-14v64H0Z"
                fill={`url(#${crossId})`}
                opacity="0.7"
              />
              <path
                d="M50 180c18-34 38-48 62-50 21-2 36 9 46 32"
                fill="none"
                stroke="#2F2D29"
                strokeWidth="1.3"
                opacity="0.6"
              />
              <path
                d="M122 130c-6 24-2 44 14 60"
                fill="none"
                stroke="#2F2D29"
                strokeWidth="1"
                opacity="0.4"
              />
              <g fill="#2F2D29" opacity="0.5">
                <circle cx="84" cy="96" r="1.3" />
                <circle cx="104" cy="108" r="1" />
                <circle cx="314" cy="190" r="1.2" />
                <circle cx="330" cy="176" r="0.8" />
              </g>
              <rect
                width="400"
                height="300"
                filter={`url(#${grainId})`}
                opacity="0.5"
              />
            </>
          )}
        </g>
      </svg>

      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-paper/85 px-2 py-0.5 text-[10px] tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}
