// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import type { ErrorCode } from "../errors.ts";

export interface SuccessEnvelope<T = unknown> {
  ok: true;
  data: T;
  meta?: {
    duration_ms?: number;
    rate_limit_remaining?: number;
    from_cache?: boolean;
  };
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    hint?: string;
    details?: Record<string, unknown>;
  };
}

export type Envelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

export function ok<T>(data: T, meta?: SuccessEnvelope<T>["meta"]): SuccessEnvelope<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function err(
  code: ErrorCode,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return {
    ok: false,
    error: { code, message, ...(hint ? { hint } : {}), ...(details ? { details } : {}) },
  };
}
