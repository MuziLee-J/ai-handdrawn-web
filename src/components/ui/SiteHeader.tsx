'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/95">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-2 px-4 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="绘相首页"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-paper">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 17.5c2.8-.6 4.7-1.8 6.2-3.7 1.5-1.9 2.6-4.2 4.6-5.3 1.2-.7 2.3-.6 3.2.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M4.5 19.5c4.8.4 10.9-.2 15-3.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity=".55"
              />
              <circle cx="17.6" cy="5.4" r="1.8" fill="#C77D6A" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-serif text-lg tracking-wide">绘相</span>
            <span className="mt-1 hidden text-[10px] tracking-[0.18em] text-muted sm:block">
              HANDDRAWN STUDIO
            </span>
          </span>
        </Link>

        <nav
          className="flex shrink-0 items-center gap-0.5 sm:gap-2"
          aria-label="主导航"
        >
          <Link
            href="/"
            className={cn(
              'hidden rounded-full px-4 py-2 text-sm transition-colors sm:inline-flex',
              pathname === '/'
                ? 'text-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            首页
          </Link>
          <Link
            href="/works"
            className={cn(
              'inline-flex rounded-full px-2.5 py-2 text-sm transition-colors sm:px-4',
              pathname === '/works'
                ? 'text-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            <span className="sm:hidden">作品</span>
            <span className="hidden sm:inline">我的作品</span>
          </Link>
          <Link
            href="/create"
            className="ml-0.5 inline-flex items-center whitespace-nowrap rounded-full bg-ink px-3 py-2 text-sm text-paper transition-colors hover:bg-sage-700 sm:ml-1 sm:px-5"
          >
            <span className="sm:hidden">创作</span>
            <span className="hidden sm:inline">开始创作</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
