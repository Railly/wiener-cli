import type { WienerErrorCode } from "../errors.js";

export interface OkMeta {
  duration_ms?: number;
  rate_limit_remaining?: number;
  from_cache?: boolean;
  [key: string]: unknown;
}

export interface OkEnvelope<T = unknown> {
  ok: true;
  data: T;
  meta?: OkMeta;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: WienerErrorCode;
    message: string;
    hint?: string;
    details?: unknown;
  };
}

export type Envelope<T = unknown> = OkEnvelope<T> | ErrorEnvelope;

export function ok<T>(data: T, meta?: OkMeta): OkEnvelope<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function err(
  code: WienerErrorCode,
  message: string,
  hint?: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(hint ? { hint } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };
}
