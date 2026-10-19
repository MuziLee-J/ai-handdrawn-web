import type {
  PublicStylePreset,
  StyleId,
  Fidelity,
  CompositionMode,
  TaskStatus,
} from '../ai/types';
import type { EditorDoc } from '../editor/types';

export interface AssetDto {
  id: string;
  kind: 'source' | 'generated';
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

export interface QuotaDto {
  used: number;
  limit: number;
  remaining: number;
  globalUsed: number;
  globalLimit: number;
}

export interface ProviderInfoDto {
  id: string;
  label: string;
  model: string;
  isMock: boolean;
  supportsCancel: boolean;
}

export interface SessionResponse {
  session: { id: string };
  quota: QuotaDto;
  provider: ProviderInfoDto | null;
  aiConfigured: boolean;
  estimatedCostCents: number;
}

export interface TaskDto {
  id: string;
  status: TaskStatus;
  styleId: StyleId;
  styleName: string;
  provider: {
    id: string;
    label: string;
    isMock: boolean;
  };
  model: string;
  fidelity: Fidelity;
  composition: CompositionMode;
  promptVersion: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  result: AssetDto | null;
  costCents: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkDto {
  id: string;
  title: string;
  doc: EditorDoc;
  sourceAsset: AssetDto | null;
  resultAsset: AssetDto | null;
  styleId: string | null;
  templateId: string | null;
  providerId: string | null;
  isMock: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; retryable?: boolean; details?: unknown },
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options?.status ?? 0;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    details?: unknown;
  };
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: ErrorEnvelope | null = null;
  try {
    payload = (await response.json()) as ErrorEnvelope;
  } catch {
    payload = null;
  }
  return new ApiError(
    payload?.error?.code ?? 'HTTP_ERROR',
    payload?.error?.message ?? `请求失败（HTTP ${response.status}）`,
    {
      status: response.status,
      retryable: payload?.error?.retryable ?? false,
      details: payload?.error?.details,
    },
  );
}

async function request<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 25_000,
  );
  try {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...(options?.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(options?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw await parseError(response);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('TIMEOUT', '请求超时，请检查网络后重试。', {
        retryable: true,
      });
    }
    throw new ApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : '网络请求失败',
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/api/session');
}

export async function getStyles(): Promise<{
  styles: PublicStylePreset[];
  promptVersion: string;
}> {
  return request('/api/styles');
}

export async function uploadSourceImage(file: File): Promise<AssetDto> {
  const formData = new FormData();
  formData.append('file', file, file.name || 'photo.jpg');
  const result = await request<{ asset: AssetDto }>('/api/upload', {
    method: 'POST',
    body: formData,
    timeoutMs: 90_000,
  });
  return result.asset;
}

export async function createGeneration(input: {
  sourceAssetId: string;
  styleId: StyleId;
  fidelity: Fidelity;
  composition: CompositionMode;
  idempotencyKey: string;
}): Promise<TaskDto> {
  const result = await request<{ task: TaskDto }>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 30_000,
  });
  return result.task;
}

export async function getTask(taskId: string): Promise<TaskDto> {
  const result = await request<{ task: TaskDto }>(`/api/tasks/${taskId}`, {
    timeoutMs: 15_000,
  });
  return result.task;
}

export async function cancelTask(taskId: string): Promise<TaskDto> {
  const result = await request<{ task: TaskDto }>(
    `/api/tasks/${taskId}/cancel`,
    { method: 'POST', timeoutMs: 15_000 },
  );
  return result.task;
}

export async function listWorks(): Promise<WorkDto[]> {
  const result = await request<{ works: WorkDto[] }>('/api/works');
  return result.works;
}

export async function getWork(workId: string): Promise<WorkDto> {
  const result = await request<{ work: WorkDto }>(`/api/works/${workId}`);
  return result.work;
}

export async function createWork(input: {
  title: string;
  doc: EditorDoc;
  sourceAssetId?: string | null;
  resultAssetId?: string | null;
  styleId?: string | null;
  templateId?: string | null;
}): Promise<WorkDto> {
  const result = await request<{ work: WorkDto }>('/api/works', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.work;
}

export async function updateWork(
  workId: string,
  input: { title?: string; doc?: EditorDoc },
): Promise<WorkDto> {
  const result = await request<{ work: WorkDto }>(`/api/works/${workId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.work;
}

export async function deleteWork(workId: string): Promise<void> {
  await request<{ ok: true }>(`/api/works/${workId}`, {
    method: 'DELETE',
  });
}
