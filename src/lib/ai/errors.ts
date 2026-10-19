import type { ProviderErrorCode } from './types';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly detail?: string;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: { retryable?: boolean; httpStatus?: number; detail?: string },
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.httpStatus = options?.httpStatus;
    this.detail = options?.detail;
  }
}
