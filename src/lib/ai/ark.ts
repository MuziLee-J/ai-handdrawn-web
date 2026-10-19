import { inspectImage } from '../server/images';
import { ProviderError } from './errors';
import { computeArkOutputSize } from './size';
import type {
  ImageProvider,
  StyledImageRequest,
  StyledImageResult,
} from './types';

interface ArkImageData {
  url?: string;
  b64_json?: string;
  size?: string;
}

interface ArkResponse {
  data?: ArkImageData[];
  usage?: Record<string, unknown>;
  error?: { code?: string; message?: string };
}

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_MODEL = 'doubao-seedream-5-0-flash-260915';
const DOWNLOAD_TIMEOUT_MS = 60_000;

function getTimeoutMs(): number {
  const value = Number(process.env.ARK_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(value) && value >= 5_000 ? value : 120_000;
}

function combineSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

function mapStatusError(
  status: number,
  code: string | undefined,
  message: string,
): ProviderError {
  const lowerCode = (code ?? '').toLowerCase();
  const lowerMessage = message.toLowerCase();

  if (status === 401 || status === 403) {
    return new ProviderError('AUTH_FAILED', 'AI 服务鉴权失败，请检查服务端 API Key。', {
      httpStatus: status,
      detail: message,
    });
  }
  if (status === 404 && (lowerCode.includes('model') || lowerMessage.includes('model'))) {
    return new ProviderError(
      'ACCOUNT_NOT_ACTIVATED',
      '模型或推理服务未开通，请在火山方舟控制台确认已开通 Seedream 4.0。',
      { httpStatus: status, detail: message },
    );
  }
  if (status === 429) {
    return new ProviderError('RATE_LIMITED', 'AI 服务当前限流，请稍后再试。', {
      httpStatus: status,
      retryable: true,
      detail: message,
    });
  }
  if (
    lowerCode.includes('sensitive') ||
    lowerCode.includes('content') ||
    lowerMessage.includes('审核') ||
    lowerMessage.includes('敏感') ||
    lowerMessage.includes('policy')
  ) {
    return new ProviderError(
      'CONTENT_BLOCKED',
      '图片未通过内容安全审核，请更换照片后重试。',
      { httpStatus: status, detail: message },
    );
  }
  if (status === 400 || status === 422) {
    return new ProviderError('INVALID_INPUT', 'AI 服务无法处理该图片或提示词。', {
      httpStatus: status,
      detail: message,
    });
  }
  return new ProviderError('UPSTREAM_ERROR', 'AI 服务暂时不可用，请稍后重试。', {
    httpStatus: status,
    retryable: status >= 500,
    detail: message,
  });
}

async function safeJson(response: Response): Promise<ArkResponse | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ArkResponse;
  } catch {
    return null;
  }
}

async function downloadResult(url: string): Promise<Buffer> {
  let lastError: unknown;
  // 只重试“下载结果”，不会重新生成，因此不会产生额外生成费用。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { signal, cleanup } = combineSignals(undefined, DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } finally {
      cleanup();
    }
  }
  throw new ProviderError(
    'RESULT_DOWNLOAD_FAILED',
    '生成成功，但下载结果图片失败。请稍后重新生成；本次可能已产生费用。',
    { detail: lastError instanceof Error ? lastError.message : String(lastError) },
  );
}

export class ArkProvider implements ImageProvider {
  readonly id = 'ark';
  readonly label = '火山方舟 Seedream';
  readonly model: string;
  readonly supportsCancel = false;
  readonly isMock = false;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = options?.apiKey ?? process.env.ARK_API_KEY ?? '';
    this.baseUrl = (
      options?.baseUrl ??
      process.env.ARK_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/$/, '');
    this.model = options?.model ?? process.env.ARK_MODEL ?? DEFAULT_MODEL;
    if (!this.apiKey) {
      throw new Error('ARK_API_KEY 未配置');
    }
  }

  async generateStyledImage(input: StyledImageRequest): Promise<StyledImageResult> {
    const outputSize = computeArkOutputSize(
      input.source.width,
      input.source.height,
    );
    const dataUrl = `data:${input.source.mime};base64,${input.source.buffer.toString('base64')}`;

    // Seedream 5.0 flash / 5.0 pro 不支持 sequential_image_generation 参数；
    // 发送该字段会被供应商拒绝。其他 4.x / 5.0 lite 保持显式 disabled。
    const supportsSequentialImageGeneration =
      !/seedream-5-0-(flash|pro)/i.test(this.model);

    const body = {
      model: this.model,
      prompt: input.prompt,
      image: dataUrl,
      size: `${outputSize.width}x${outputSize.height}`,
      response_format: 'url',
      watermark: false,
      ...(supportsSequentialImageGeneration
        ? { sequential_image_generation: 'disabled' as const }
        : {}),
    };

    const { signal, cleanup } = combineSignals(input.signal, getTimeoutMs());

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
        cache: 'no-store',
      });
    } catch (error) {
      cleanup();
      if (input.signal?.aborted) {
        throw new ProviderError('TIMEOUT', '任务已取消。');
      }
      const isTimeout =
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new ProviderError(
        isTimeout ? 'TIMEOUT' : 'UPSTREAM_ERROR',
        isTimeout
          ? 'AI 服务响应超时。本次可能已产生费用，请先查看任务记录后再决定是否重试。'
          : '无法连接 AI 服务，请检查网络或服务端配置。',
        { retryable: !isTimeout, detail: error instanceof Error ? error.message : String(error) },
      );
    } finally {
      cleanup();
    }

    const payload = await safeJson(response);
    if (!response.ok) {
      throw mapStatusError(
        response.status,
        payload?.error?.code,
        payload?.error?.message ?? 'AI 服务返回错误',
      );
    }

    const first = payload?.data?.[0];
    if (!first?.url && !first?.b64_json) {
      throw new ProviderError(
        'INVALID_RESPONSE',
        'AI 服务没有返回可用图片，请稍后重试。',
        { detail: JSON.stringify(payload?.error ?? {}).slice(0, 500) },
      );
    }

    const buffer = first.b64_json
      ? Buffer.from(first.b64_json, 'base64')
      : await downloadResult(first.url as string);

    let detected;
    try {
      detected = inspectImage(buffer, { maxPixels: 36_000_000 });
    } catch (error) {
      throw new ProviderError(
        'INVALID_RESPONSE',
        'AI 返回的图片格式无法识别。',
        { detail: error instanceof Error ? error.message : String(error) },
      );
    }

    const usage: Record<string, number> = {};
    for (const [key, value] of Object.entries(payload?.usage ?? {})) {
      if (typeof value === 'number') usage[key] = value;
    }

    return {
      providerId: this.id,
      model: this.model,
      buffer,
      mime: detected.mime,
      width: detected.width,
      height: detected.height,
      providerRequestId:
        response.headers.get('x-request-id') ??
        response.headers.get('x-tt-logid') ??
        undefined,
      usage: Object.keys(usage).length ? usage : undefined,
    };
  }
}
