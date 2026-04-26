// PHASE A WILL REPLACE — stub only; shape matches Phase A contract

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
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly hint?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WienerError";
  }
}

export function isWienerError(err: unknown): err is WienerError {
  return err instanceof WienerError;
}
