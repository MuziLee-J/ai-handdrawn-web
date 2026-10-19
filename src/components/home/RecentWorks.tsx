'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { listWorks, type WorkDto } from '@/lib/client/api';
import { formatDate } from '@/lib/utils';

export function RecentWorks() {
  const [works, setWorks] = useState<WorkDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listWorks()
      .then((items) => {
        if (!cancelled) setWorks(items.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (works === null && !failed) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-line bg-surface/60 text-sm text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        正在读取作品…
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">
        作品列表暂时无法加载。你仍然可以开始新的创作。
      </div>
    );
  }

  if (!works || works.length === 0) {
    return (
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-line bg-surface/50 p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium text-ink">还没有保存的作品</p>
          <p className="mt-1 text-sm text-muted">
            生成一张手绘图片后，进入排版编辑器即可保存作品。
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 hover:text-ink"
        >
          开始第一张
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {works.map((work) => (
        <Link
          key={work.id}
          href={`/editor/${work.id}`}
          className="group overflow-hidden rounded-2xl border border-line bg-surface transition-transform duration-300 hover:-translate-y-0.5"
        >
          <div className="aspect-[4/3] overflow-hidden bg-paper">
            {work.thumbnailUrl ? (
              <img
                src={work.thumbnailUrl}
                alt={work.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted">
                暂无预览
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{work.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {formatDate(work.updatedAt)}
              </p>
            </div>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink"
              aria-hidden="true"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
