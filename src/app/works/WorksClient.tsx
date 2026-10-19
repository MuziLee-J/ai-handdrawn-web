'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  deleteWork,
  listWorks,
  type WorkDto,
} from '@/lib/client/api';
import { formatDate } from '@/lib/utils';

export function WorksClient() {
  const [works, setWorks] = useState<WorkDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWorks()
      .then((items) => {
        if (!cancelled) setWorks(items);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : '作品加载失败',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(work: WorkDto) {
    const confirmed = window.confirm(
      `确定删除「${work.title}」吗？删除后无法在这个作品集中继续编辑。`,
    );
    if (!confirmed) return;
    setDeletingId(work.id);
    setError(null);
    try {
      await deleteWork(work.id);
      setWorks((current) =>
        current ? current.filter((item) => item.id !== work.id) : current,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : '删除失败',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-page px-5 pb-20 pt-8 sm:px-8 lg:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted">GALLERY</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
            我的作品
          </h1>
          <p className="mt-2 text-sm text-muted">
            作品保存在当前浏览器匿名会话中，不会自动同步到其他设备。
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm text-paper hover:bg-sage-700"
        >
          新建作品
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {works === null && !error && (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          正在读取作品…
        </div>
      )}

      {works?.length === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-16 text-center">
          <ImagePlus className="h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl">还没有作品</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            上传一张照片，选择手绘风格并生成结果后，进入排版编辑器保存第一件作品。
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm text-paper hover:bg-sage-700"
          >
            开始创作
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {works && works.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((work) => (
            <article
              key={work.id}
              className="group overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <Link href={`/editor/${work.id}`} className="block">
                <div className="relative aspect-[4/3] overflow-hidden bg-paper">
                  {work.thumbnailUrl ? (
                    <img
                      src={work.thumbnailUrl}
                      alt={work.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">
                      暂无预览图
                    </div>
                  )}
                  {work.isMock && (
                    <span className="absolute left-3 top-3 rounded-full bg-amber-100/95 px-2.5 py-1 text-[10px] font-medium text-amber-900">
                      演示图 · 非 AI
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/editor/${work.id}`}
                    className="block truncate text-sm font-medium hover:text-sage-700"
                  >
                    {work.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    更新于 {formatDate(work.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(work)}
                  disabled={deletingId === work.id}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-clay/40 hover:text-clay disabled:opacity-40"
                  aria-label={`删除作品 ${work.title}`}
                >
                  {deletingId === work.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
