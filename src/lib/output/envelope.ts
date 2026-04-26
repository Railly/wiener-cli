// PHASE A WILL REPLACE — stub for Phase D
export interface Meta {
  duration_ms?: number;
  rate_limit_remaining?: number;
  from_cache?: boolean;
}

export interface OkEnvelope<T> {
  ok: true;
  data: T;
  meta?: Meta;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    hint?: string;
    details?: unknown;
  };
}

export type Envelope<T> = OkEnvelope<T> | ErrorEnvelope;

export function ok<T>(data: T, meta?: Meta): OkEnvelope<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function err(code: string, message: string, hint?: string, details?: unknown): ErrorEnvelope {
  return {
    ok: false,
    error: { code, message, ...(hint ? { hint } : {}), ...(details ? { details } : {}) },
  };
}
