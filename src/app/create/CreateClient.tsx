'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { STYLE_IDS, STYLE_PRESETS } from '@/lib/ai/styles';
import type {
  CompositionMode,
  Fidelity,
  StyleId,
  TaskStatus,
} from '@/lib/ai/types';
import {
  ApiError,
  cancelTask,
  createGeneration,
  createWork,
  getSession,
  getTask,
  type AssetDto,
  type SessionResponse,
  type TaskDto,
} from '@/lib/client/api';
import { createTemplateDoc } from '@/lib/editor/templates';
import { StylePreview } from '@/components/ui/StylePreview';
import { UploadCropper } from '@/components/upload/UploadCropper';
import { CompareSlider } from '@/components/result/CompareSlider';
import { cn, downloadUrl, formatDate, uid } from '@/lib/utils';

type Step = 'upload' | 'style' | 'result';

const STEP_ITEMS: Array<{ id: Step; label: string }> = [
  { id: 'upload', label: '上传照片' },
  { id: 'style', label: '选择风格' },
  { id: 'result', label: '生成结果' },
];

const COMPOSITION_OPTIONS: Array<{
  id: CompositionMode;
  label: string;
  description: string;
}> = [
  {
    id: 'full',
    label: '满版',
    description: '主体与环境铺满画面，保留更多背景和细节。',
  },
  {
    id: 'sketchbook',
    label: '手账留白',
    description:
      '主体置于米白纸张中央，四周留白、边缘不规则；不添加日期或地点文字。',
  },
];

const FIDELITY_OPTIONS: Array<{
  id: Fidelity;
  label: string;
  description: string;
}> = [
  {
    id: 'faithful',
    label: '更接近原图',
    description: '严格保留构图与细节，艺术化处理更克制。',
  },
  {
    id: 'balanced',
    label: '平衡',
    description: '保留主体与构图，允许对细节和背景做适度概括。',
  },
  {
    id: 'artistic',
    label: '更艺术化',
    description: '加强笔触与色彩表达，但主体仍清晰可辨。',
  },
];

function isStyleId(value: string | null): value is StyleId {
  return value !== null && STYLE_IDS.includes(value as StyleId);
}

function isTerminal(status: TaskStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '发生未知错误。';
}

function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    queued: '排队中',
    processing: '正在绘制',
    succeeded: '生成完成',
    failed: '生成失败',
    cancelled: '已取消',
  };
  return labels[status];
}

function compositionLabel(composition: CompositionMode): string {
  return (
    COMPOSITION_OPTIONS.find((item) => item.id === composition)?.label ?? '满版'
  );
}

export function CreateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStyle = searchParams.get('style');
  const initialStyle: StyleId = isStyleId(queryStyle) ? queryStyle : 'watercolor';

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [sourceAsset, setSourceAsset] = useState<AssetDto | null>(null);
  const [styleId, setStyleId] = useState<StyleId>(initialStyle);
  const [composition, setComposition] = useState<CompositionMode>('full');
  const [fidelity, setFidelity] = useState<Fidelity>('balanced');
  const [submitting, setSubmitting] = useState(false);
  const [creatingWork, setCreatingWork] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskDto | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const attemptKeyRef = useRef<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const data = await getSession();
      setSession(data);
      setSessionError(null);
    } catch (sessionFetchError) {
      setSessionError(errorMessage(sessionFetchError));
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!task || (task.status !== 'queued' && task.status !== 'processing')) {
      return;
    }
    const startedAt = new Date(task.createdAt).getTime();
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [task?.status, task?.createdAt]);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const tick = async () => {
      try {
        const next = await getTask(taskId);
        if (cancelled) return;
        setTask(next);
        setPollError(null);
        if (isTerminal(next.status)) {
          void refreshSession();
          return;
        }
        timer = setTimeout(tick, 1500);
      } catch (pollFailure) {
        failures += 1;
        if (cancelled) return;
        if (failures <= 3) {
          timer = setTimeout(tick, 2500);
        } else {
          setPollError(
            '无法获取任务状态。任务可能仍在服务端处理，请稍后刷新页面查看。',
          );
        }
      }
    };

    timer = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId, refreshSession]);

  const style = STYLE_PRESETS[styleId];
  const isMock = session?.provider?.isMock ?? task?.provider.isMock ?? false;
  const remaining = session?.quota.remaining ?? null;
  const estimatedCostLabel = `¥${(
    (session?.estimatedCostCents ?? 12) / 100
  ).toFixed(2)}`;

  async function handleGenerate(fresh: boolean) {
    if (!sourceAsset || submitting) return;
    if (remaining !== null && remaining <= 0) {
      setError('今日生成次数已用完，请明天再试。');
      return;
    }

    if (fresh) {
      attemptKeyRef.current = null;
      setTask(null);
      setTaskId(null);
    }

    let key = attemptKeyRef.current;
    if (!key) {
      key = uid('gen');
      attemptKeyRef.current = key;
    }

    setSubmitting(true);
    setError(null);
    setPollError(null);
    setStep('result');

    try {
      const created = await createGeneration({
        sourceAssetId: sourceAsset.id,
        styleId,
        fidelity,
        composition,
        idempotencyKey: key,
      });
      setTask(created);
      setTaskId(created.id);
      void refreshSession();
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setSubmitting(false);
    }
  }

  function handleRegenerate() {
    if (!isMock) {
      const confirmed = window.confirm(
        `重新生成会产生一次新的 AI 调用，可能再次计费（参考价约 ${estimatedCostLabel}/张，以供应商账单为准）。继续吗？`,
      );
      if (!confirmed) return;
    }
    void handleGenerate(true);
  }

  function handleChangeStyle() {
    attemptKeyRef.current = null;
    setTask(null);
    setTaskId(null);
    setError(null);
    setPollError(null);
    setStep('style');
  }

  async function handleCancel() {
    if (!task) return;
    try {
      const cancelledTask = await cancelTask(task.id);
      setTask(cancelledTask);
      void refreshSession();
    } catch (cancelError) {
      setError(errorMessage(cancelError));
    }
  }

  async function handleEnterEditor() {
    if (!sourceAsset || !task?.result || creatingWork) return;
    setCreatingWork(true);
    setError(null);
    try {
      const doc = createTemplateDoc('single-poster', {
        sourceAssetId: sourceAsset.id,
        resultAssetId: task.result.id,
        title: '未命名作品',
        date: formatDate(new Date()),
      });
      const work = await createWork({
        title: '未命名作品',
        doc,
        sourceAssetId: sourceAsset.id,
        resultAssetId: task.result.id,
        styleId,
        templateId: 'single-poster',
      });
      router.push(`/editor/${work.id}`);
    } catch (workError) {
      setError(errorMessage(workError));
    } finally {
      setCreatingWork(false);
    }
  }

  function handleDownload() {
    if (!task?.result) return;
    const extension = task.result.mime === 'image/png' ? 'png' : 'jpg';
    downloadUrl(
      task.result.url,
      `handdrawn-${styleId}-${task.id.slice(0, 8)}.${extension}`,
    );
  }

  const stepIndex = STEP_ITEMS.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto max-w-page px-5 pb-20 pt-6 sm:px-8 lg:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回首页
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted">
          {session && (
            <span className="rounded-full border border-line bg-surface px-3 py-1.5">
              今日剩余{' '}
              <strong className="font-semibold text-ink">
                {session.quota.remaining}
              </strong>{' '}
              / {session.quota.limit} 次
            </span>
          )}
          <span>单浏览器会话</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted">CREATE</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
            新建手绘作品
          </h1>
        </div>
        <ol className="flex items-center gap-2 text-xs text-muted">
          {STEP_ITEMS.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
                  index < stepIndex
                    ? 'border-sage-600 bg-sage-600 text-white'
                    : index === stepIndex
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-surface',
                )}
              >
                {index < stepIndex ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span className={index === stepIndex ? 'text-ink' : ''}>
                {item.label}
              </span>
              {index < STEP_ITEMS.length - 1 && (
                <span className="h-px w-4 bg-line" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>

      {sessionError && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>会话信息加载失败：{sessionError}。你仍然可以尝试上传。</span>
        </div>
      )}

      {session?.provider?.isMock && (
        <div className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">当前为演示模式，不是真实 AI 生成。</p>
          <p className="mt-1 text-amber-800">
            服务端未配置 `ARK_API_KEY`，生成结果由程序化绘制的演示图替代。
            配置真实 Key 后，任务会显示供应商与真实模型。
          </p>
        </div>
      )}

      {session && !session.aiConfigured && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            AI 服务未配置。请在 `.env.local` 填写 `ARK_API_KEY`，
            或仅在开发环境设置 `ALLOW_MOCK_AI=true` 使用演示图。
          </span>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-xs underline underline-offset-2"
          >
            关闭
          </button>
        </div>
      )}

      {step === 'upload' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <UploadCropper
            uploadedAsset={sourceAsset}
            onUploaded={(asset) => {
              setSourceAsset(asset);
              setError(null);
            }}
          />

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="font-serif text-xl">选一张适合转绘的照片</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                <li className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-sage-600"
                    aria-hidden="true"
                  />
                  主体清晰、光线均匀，画面里不要有太多小字。
                </li>
                <li className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-sage-600"
                    aria-hidden="true"
                  />
                  人像、宠物、建筑、食物、日常物品都可以；题材不设限。
                </li>
                <li className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-sage-600"
                    aria-hidden="true"
                  />
                  裁剪只影响上传副本，原始文件不会被修改。
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-5 text-sm leading-6 text-muted">
              <p className="flex items-center gap-2 font-medium text-ink">
                <Sparkles className="h-4 w-4 text-sage-600" aria-hidden="true" />
                下一步
              </p>
              <p className="mt-2">
                上传完成后，选择水彩、彩铅或钢笔速写，并决定更接近原图还是更艺术化。
              </p>
              <button
                type="button"
                disabled={!sourceAsset}
                onClick={() => setStep('style')}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-sage-700 disabled:cursor-not-allowed disabled:bg-muted/40"
              >
                下一步：选择风格
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {step === 'style' && sourceAsset && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <img
                src={sourceAsset.url}
                alt="待转绘的原始照片"
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">原始照片已就绪</p>
                <p className="mt-0.5 text-xs text-muted">
                  {sourceAsset.width} × {sourceAsset.height}px
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="ml-auto text-xs text-muted hover:text-ink"
              >
                更换
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {STYLE_IDS.map((id) => {
                const item = STYLE_PRESETS[id];
                const selected = styleId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStyleId(id)}
                    aria-pressed={selected}
                    className={cn(
                      'overflow-hidden rounded-2xl border bg-surface text-left transition-all',
                      selected
                        ? 'border-sage-600 ring-2 ring-sage-500/25'
                        : 'border-line hover:border-ink/25',
                    )}
                  >
                    <StylePreview
                      styleId={id}
                      className="aspect-[4/3] w-full"
                    />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif text-lg">{item.name}</span>
                        {selected && (
                          <CheckCircle2
                            className="h-4 w-4 text-sage-600"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {item.subtitle}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-xl">构图方式</h2>
                <span className="text-[11px] text-muted">
                  手账留白不会自动添加日期或地点
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {COMPOSITION_OPTIONS.map((item) => {
                  const selected = composition === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`composition-${item.id}`}
                      onClick={() => setComposition(item.id)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-colors',
                        selected
                          ? 'border-sage-600 bg-sage-50 ring-2 ring-sage-500/20'
                          : 'border-line bg-paper hover:border-ink/25',
                      )}
                    >
                      <div
                        className={cn(
                          'relative mb-3 h-20 overflow-hidden rounded-lg border',
                          item.id === 'sketchbook'
                            ? 'border-[#DED4C3] bg-[#FBF7EE]'
                            : 'border-sage-100 bg-sage-100',
                        )}
                        aria-hidden="true"
                      >
                        {item.id === 'full' ? (
                          <span className="absolute inset-1.5 rounded bg-sage-500/35" />
                        ) : (
                          <>
                            <span className="absolute inset-x-4 inset-y-2 rounded-sm border border-dashed border-[#DED4C3]" />
                            <span className="absolute left-1/2 top-1/2 h-10 w-8 -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-sage-500/40" />
                            <span className="absolute bottom-3 left-4 h-1 w-8 rounded-full bg-[#C9BBA8]" />
                            <span className="absolute bottom-5 right-4 h-1 w-6 rounded-full bg-[#C9BBA8]" />
                          </>
                        )}
                      </div>
                      <span className="flex items-center justify-between gap-2 text-sm font-medium">
                        {item.label}
                        {selected && (
                          <CheckCircle2
                            className="h-4 w-4 text-sage-600"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted">
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              {composition === 'sketchbook' && (
                <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11px] leading-5 text-muted">
                  提示词会要求主体保留辨识度、概括背景；生成后还会把 AI 结果置于米白纸张中央，确保四周保留大面积留白。不会自动生成日期、地点或签名。
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-xl">与原图的接近程度</h2>
                <span className="text-[11px] text-muted">
                  通过提示词控制，不是伪造的模型参数
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {FIDELITY_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFidelity(item.id)}
                    aria-pressed={fidelity === item.id}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      fidelity === item.id
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line bg-paper text-ink hover:border-ink/25',
                    )}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span
                      className={cn(
                        'mt-1 block text-[11px] leading-4',
                        fidelity === item.id ? 'text-paper/75' : 'text-muted',
                      )}
                    >
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs tracking-[0.16em] text-muted">SUMMARY</p>
              <h2 className="mt-1 font-serif text-2xl">{style.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {style.description}
              </p>
              <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-muted">
                <div className="flex justify-between gap-3">
                  <span>保真度</span>
                  <span className="text-ink">
                    {FIDELITY_OPTIONS.find((item) => item.id === fidelity)?.label}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>构图</span>
                  <span className="text-ink">{compositionLabel(composition)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>输出</span>
                  <span className="text-ink">按原图比例，约 2K</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>参考费用</span>
                  <span className="text-ink">
                    {isMock ? '演示模式，0 元' : `约 ${estimatedCostLabel} / 张`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerate(false)}
                disabled={submitting || (remaining !== null && remaining <= 0)}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-sage-700 disabled:cursor-not-allowed disabled:bg-muted/40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    正在提交任务…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                    开始生成手绘图
                  </>
                )}
              </button>
              <p className="mt-3 text-[11px] leading-5 text-muted">
                重复点击会被禁用，服务端还会用幂等键阻止同一任务重复提交。
                失败或审核未通过通常不产生图片费用。
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-4 text-xs leading-5 text-muted">
              <p className="flex items-center gap-1.5 font-medium text-ink">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                生成通常需要几十秒
              </p>
              <p className="mt-1.5">
                图片会先上传到本机服务端，再由服务端调用 AI；浏览器不会接触模型密钥。
              </p>
            </div>
          </aside>
        </div>
      )}

      {step === 'result' && (
        <div className="mt-8">
          {!task && submitting && (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-line bg-surface">
              <Loader2 className="h-7 w-7 animate-spin text-sage-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-medium">正在创建生成任务…</p>
              <p className="mt-1 text-xs text-muted">
                服务端完成校验后才会调用 AI 服务。
              </p>
            </div>
          )}

          {!task && !submitting && !error && (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
              请选择照片和风格后开始生成。
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="mt-4 block w-full text-sage-700 hover:text-ink"
              >
                返回上传
              </button>
            </div>
          )}

          {task && task.status !== 'succeeded' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-line bg-surface p-8 text-center">
                {task.status === 'failed' ? (
                  <AlertCircle className="h-9 w-9 text-clay" aria-hidden="true" />
                ) : task.status === 'cancelled' ? (
                  <AlertCircle className="h-9 w-9 text-muted" aria-hidden="true" />
                ) : (
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-sage-50 text-sage-600">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  </span>
                )}
                <h2 className="mt-5 font-serif text-2xl">
                  {statusLabel(task.status)}
                </h2>
                {task.status === 'queued' && (
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                    任务已在服务端排队，尚未发送给 AI 服务。你可以取消排队，不会产生模型调用。
                  </p>
                )}
                {task.status === 'processing' && (
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                    AI 服务正在生成。当前供应商不提供可查询的精确进度百分比，
                    因此这里不显示伪造进度条；页面会持续轮询真实任务状态。
                  </p>
                )}
                {task.status === 'failed' && (
                  <>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                      {task.error?.message ?? '生成失败，请稍后重试。'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      错误码：{task.error?.code ?? 'UNKNOWN'}
                      {task.error?.retryable ? ' · 可能可以重试' : ''}
                    </p>
                  </>
                )}
                {task.status === 'cancelled' && (
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                    任务已取消。若尚未发送给供应商，预占额度会自动退回。
                  </p>
                )}
                {(task.status === 'queued' || task.status === 'processing') && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    已等待 {elapsed} 秒 · 任务 {task.id.slice(0, 8)}
                  </p>
                )}
                {pollError && (
                  <p className="mt-4 rounded-xl border border-clay/30 bg-clay/5 px-4 py-2.5 text-xs text-clay">
                    {pollError}
                  </p>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <p className="text-xs tracking-[0.16em] text-muted">TASK</p>
                  <h3 className="mt-1 font-serif text-xl">{task.styleName}</h3>
                  <dl className="mt-4 space-y-2 text-xs text-muted">
                    <div className="flex justify-between gap-3">
                      <dt>供应商</dt>
                      <dd className="text-ink">{task.provider.label}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>模型</dt>
                      <dd className="max-w-[190px] truncate text-right text-ink">
                        {task.model}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>构图</dt>
                      <dd className="text-ink">{compositionLabel(task.composition)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>状态</dt>
                      <dd className="text-ink">{statusLabel(task.status)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>参考费用</dt>
                      <dd className="text-ink">
                        {task.provider.isMock
                          ? '0 元'
                          : `¥${(task.costCents / 100).toFixed(2)}`}
                      </dd>
                    </div>
                  </dl>

                  {task.status === 'queued' && (
                    <button
                      type="button"
                      onClick={() => void handleCancel()}
                      className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-full border border-line px-4 text-sm text-muted hover:text-ink"
                    >
                      取消排队
                    </button>
                  )}

                  {task.status === 'failed' && (
                    <div className="mt-5 space-y-2">
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm text-paper hover:bg-sage-700"
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        重新生成
                      </button>
                      <button
                        type="button"
                        onClick={handleChangeStyle}
                        className="inline-flex h-10 w-full items-center justify-center rounded-full border border-line px-4 text-sm text-muted hover:text-ink"
                      >
                        更换风格
                      </button>
                    </div>
                  )}

                  {task.status === 'cancelled' && (
                    <button
                      type="button"
                      onClick={handleChangeStyle}
                      className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-full border border-line px-4 text-sm text-muted hover:text-ink"
                    >
                      返回风格选择
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleChangeStyle}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-3 text-sm text-muted hover:text-ink"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  换一种风格
                </button>
              </aside>
            </div>
          )}

          {task?.status === 'succeeded' && task.result && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                <CompareSlider
                  originalUrl={sourceAsset?.url ?? task.result.url}
                  resultUrl={task.result.url}
                />
                {task.provider.isMock && (
                  <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                    这是程序化演示图，不是 AI 生成结果。配置真实 ARK_API_KEY 后重新生成即可。
                  </p>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-center gap-2 text-sage-700">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <span className="text-sm font-medium">生成完成</span>
                  </div>
                  <h2 className="mt-2 font-serif text-2xl">{task.styleName}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {task.result.width} × {task.result.height}px ·{' '}
                    {task.provider.label}
                  </p>
                  <div className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">
                    <p>模型：{task.model}</p>
                    <p>构图：{compositionLabel(task.composition)}</p>
                    <p>提示词版本：{task.promptVersion}</p>
                    <p>任务：{task.id}</p>
                    <p>
                      费用：
                      {task.provider.isMock
                        ? '演示模式，未调用付费 AI'
                        : `¥${(task.costCents / 100).toFixed(2)}（以账单为准）`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleEnterEditor()}
                    disabled={creatingWork}
                    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-sage-700 disabled:cursor-not-allowed disabled:bg-muted/40"
                  >
                    {creatingWork ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        正在创建作品…
                      </>
                    ) : (
                      <>
                        <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                        进入排版编辑器
                      </>
                    )}
                  </button>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted hover:text-ink"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      重新生成
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted hover:text-ink"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      下载图片
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-paper p-4 text-xs leading-5 text-muted">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    原图与生成图都已保留
                  </p>
                  <p className="mt-1.5">
                    进入编辑器后可以切换四种模板，调整图片、中文文字、背景和装饰。
                  </p>
                  <button
                    type="button"
                    onClick={handleChangeStyle}
                    className="mt-3 inline-flex items-center gap-1 text-sage-700 hover:text-ink"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    换一种风格重新生成
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
