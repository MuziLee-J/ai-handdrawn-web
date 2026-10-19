import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ProviderError } from '../ai/errors';
import type { ProviderErrorCode } from '../ai/types';
import { ImageValidationError } from './images';

export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_IMAGE_FORMAT'
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_DIMENSIONS_INVALID'
  | 'QUOTA_EXCEEDED'
  | 'DUPLICATE_REQUEST'
  | 'TASK_NOT_CANCELLABLE'
  | 'INVALID_LAYOUT'
  | 'AI_NOT_CONFIGURED'
  | ProviderErrorCode
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { status?: number; retryable?: boolean; details?: unknown },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options?.status ?? 400;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ImageValidationError) {
    const status = error.code === 'IMAGE_TOO_LARGE' ? 413 : 400;
    return new AppError(error.code, error.message, { status });
  }

  if (error instanceof ProviderError) {
    const status =
      error.code === 'AUTH_FAILED'
        ? 502
        : error.code === 'RATE_LIMITED'
          ? 429
          : error.code === 'CONTENT_BLOCKED'
            ? 422
            : error.code === 'TIMEOUT'
              ? 504
              : 502;
    return new AppError(error.code, error.message, {
      status,
      retryable: error.retryable,
      details: error.detail,
    });
  }

  if (error instanceof ZodError) {
    return new AppError('BAD_REQUEST', '请求参数不合法。', {
      status: 400,
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (error instanceof Error) {
    console.error('[api] unhandled error:', error.name, error.message);
  } else {
    console.error('[api] unhandled non-error:', String(error));
  }

  return new AppError('INTERNAL_ERROR', '服务器内部错误，请稍后重试。', {
    status: 500,
  });
}

export function apiErrorResponse(error: unknown): NextResponse {
  const normalized = normalizeError(error);
  return NextResponse.json(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
        ...(normalized.details !== undefined
          ? { details: normalized.details }
          : {}),
      },
    },
    { status: normalized.status },
  );
}
