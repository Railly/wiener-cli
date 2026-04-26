// PHASE A WILL REPLACE: Canonical envelope builder — Phase A provides the authoritative version

export interface SuccessEnvelope<T> {
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
    code: string;
    message: string;
    hint?: string;
    details?: Record<string, unknown>;
  };
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function ok<T>(
  data: T,
  meta?: SuccessEnvelope<T>["meta"]
): SuccessEnvelope<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function err(
  code: string,
  message: string,
  hint?: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  return {
    ok: false,
    error: { code, message, ...(hint ? { hint } : {}), ...(details ? { details } : {}) },
  };
}
