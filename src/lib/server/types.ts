import type {
  CompositionMode,
  Fidelity,
  StyleId,
  TaskStatus,
} from '../ai/types';

export type AssetKind = 'source' | 'generated';

export interface SessionRow {
  id: string;
  created_at: string;
  last_seen_at: string;
}

export interface AssetRow {
  id: string;
  session_id: string;
  kind: AssetKind;
  storage_key: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  session_id: string;
  source_asset_id: string;
  style_id: StyleId;
  style_version: string;
  prompt_version: string;
  provider: string;
  model: string;
  prompt: string;
  fidelity: Fidelity;
  composition: CompositionMode;
  status: TaskStatus;
  error_code: string | null;
  error_message: string | null;
  error_retryable: number;
  result_asset_id: string | null;
  provider_request_id: string | null;
  provider_usage_json: string | null;
  cost_cents: number;
  quota_reserved: number;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface WorkRow {
  id: string;
  session_id: string;
  title: string;
  doc_json: string;
  source_asset_id: string | null;
  result_asset_id: string | null;
  style_id: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
