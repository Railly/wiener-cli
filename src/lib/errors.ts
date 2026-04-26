// Typed error hierarchy with canonical codes

export type ErrorCode =
  | "auth-required"
  | "auth-expired"
  | "canvas-not-configured"
  | "canvas-token-invalid"
  | "course-not-found"
  | "course-ambiguous"
  | "network-error"
  | "rate-limited"
  | "parse-error"
  | "validation-error"
  | "not-implemented";

export class WienerError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    hint?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "WienerError";
    this.code = code;
    if (hint) this.hint = hint;
    if (details) this.details = details;
  }
}

export function isWienerError(e: unknown): e is WienerError {
  return e instanceof WienerError;
}

export function toErrorEnvelope(e: unknown): {
  ok: false;
  error: { code: string; message: string; hint?: string; details?: Record<string, unknown> };
} {
  if (isWienerError(e)) {
    return {
      ok: false,
      error: {
        code: e.code,
        message: e.message,
        ...(e.hint ? { hint: e.hint } : {}),
        ...(e.details ? { details: e.details } : {}),
      },
    };
  }
  const message = e instanceof Error ? e.message : String(e);
  return {
    ok: false,
    error: { code: "network-error", message },
  };
}
