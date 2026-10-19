export type StyleId = 'watercolor' | 'colored-pencil' | 'pen-sketch';

export type Fidelity = 'faithful' | 'balanced' | 'artistic';

/**
 * 构图方式：
 * - full：主体与环境铺满画布，保留更多背景；
 * - sketchbook：主体以不规则边缘置于米白纸张，四周大面积留白。
 */
export type CompositionMode = 'full' | 'sketchbook';

export type TaskStatus =
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type ProviderErrorCode =
  | 'AUTH_FAILED'
  | 'ACCOUNT_NOT_ACTIVATED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'CONTENT_BLOCKED'
  | 'INVALID_INPUT'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'RESULT_DOWNLOAD_FAILED'
  | 'INVALID_RESPONSE';

export interface StylePreview {
  /** 纯 CSS/SVG 示意配色，不代表 AI 生成结果。 */
  base: string;
  wash: string;
  accent: string;
  ink: string;
  pattern: 'wash' | 'hatch' | 'line';
}

export interface StylePreset {
  id: StyleId;
  version: string;
  name: string;
  subtitle: string;
  description: string;
  medium: string;
  preview: StylePreview;
  prompt: {
    medium: string;
    technique: string;
    texture: string;
    avoid: string;
  };
}

export interface PublicStylePreset {
  id: StyleId;
  version: string;
  name: string;
  subtitle: string;
  description: string;
  medium: string;
  preview: StylePreview;
  promptVersion: string;
}

export interface SourceImage {
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
}

export interface StyledImageRequest {
  source: SourceImage;
  prompt: string;
  styleId: StyleId;
  fidelity: Fidelity;
  signal?: AbortSignal;
}

export interface StyledImageResult {
  providerId: string;
  model: string;
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
  providerRequestId?: string;
  usage?: Record<string, number>;
}

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly supportsCancel: boolean;
  readonly isMock: boolean;
  generateStyledImage(input: StyledImageRequest): Promise<StyledImageResult>;
}
