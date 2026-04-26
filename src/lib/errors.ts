export type WienerErrorCode =
  | "auth-required"
  | "auth-expired"
  | "auth-invalid-credentials"
  | "canvas-not-configured"
  | "canvas-token-invalid"
  | "course-not-found"
  | "course-ambiguous"
  | "network-error"
  | "rate-limited"
  | "parse-error"
  | "validation-error"
  | "not-implemented"
  | "unknown-error";

export const ERROR_EXIT_CODES: Record<WienerErrorCode, number> = {
  "auth-required": 1,
  "auth-expired": 1,
  "auth-invalid-credentials": 1,
  "canvas-not-configured": 1,
  "canvas-token-invalid": 1,
  "course-not-found": 1,
  "course-ambiguous": 1,
  "network-error": 1,
  "rate-limited": 1,
  "parse-error": 1,
  "validation-error": 2,
  "not-implemented": 1,
  "unknown-error": 1,
};

export class WienerError extends Error {
  readonly code: WienerErrorCode;
  readonly hint?: string;
  readonly details?: unknown;
  readonly exitCode: number;

  constructor(
    code: WienerErrorCode,
    message: string,
    optsOrHint?: { hint?: string; details?: unknown } | string,
    legacyDetails?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WienerError";
    this.code = code;
    if (typeof optsOrHint === "string") {
      this.hint = optsOrHint;
      this.details = legacyDetails;
    } else {
      this.hint = optsOrHint?.hint;
      this.details = optsOrHint?.details;
    }
    this.exitCode = ERROR_EXIT_CODES[code] ?? 1;
  }
}

export class AuthRequiredError extends WienerError {
  constructor(backend: "intranet" | "canvas") {
    const hints: Record<typeof backend, string> = {
      intranet: "Run `wiener auth login` to authenticate",
      canvas: "Run `wiener auth canvas set-token <pat>` to configure Canvas",
    };
    super("auth-required", `${backend} authentication required`, {
      hint: hints[backend],
    });
  }
}

export class AuthExpiredError extends WienerError {
  constructor() {
    super("auth-expired", "Intranet session has expired", {
      hint: "Run `wiener auth login` to re-authenticate",
    });
  }
}

export class CanvasNotConfiguredError extends WienerError {
  constructor() {
    super("canvas-not-configured", "Canvas personal access token not configured", {
      hint: "Run `wiener auth canvas set-token <pat>` to configure",
    });
  }
}

export class CanvasTokenInvalidError extends WienerError {
  constructor() {
    super("canvas-token-invalid", "Canvas token rejected (401)", {
      hint: "Regenerate via `wiener auth canvas pat new`",
    });
  }
}

export class CourseNotFoundError extends WienerError {
  constructor(input: string, closest: Array<{ code: string; name: string; score: number }>) {
    super("course-not-found", `No course found matching "${input}"`, {
      hint: "Run `wiener cursos` to see available courses",
      details: { closest },
    });
  }
}

export class CourseAmbiguousError extends WienerError {
  constructor(
    input: string,
    candidates: Array<{ code: string; name: string; alias: string; score: number }>,
  ) {
    super("course-ambiguous", `Multiple courses match "${input}"`, {
      hint: "Try `wiener cursos` to see exact aliases",
      details: { candidates },
    });
  }
}

export class NetworkError extends WienerError {
  constructor(message: string, cause?: unknown) {
    super("network-error", message, { details: { cause: String(cause) } });
  }
}

export class ParseError extends WienerError {
  constructor(target: string, details?: unknown) {
    super("parse-error", `Failed to parse ${target}`, {
      hint: "The portal HTML structure may have changed",
      details,
    });
  }
}

export class RateLimitedError extends WienerError {
  constructor(remaining: number) {
    super("rate-limited", `Canvas rate limit low: ${remaining} remaining`, {
      hint: "Wait before making more requests",
    });
  }
}

export class NotImplementedError extends WienerError {
  constructor(command: string) {
    super("not-implemented", `${command} is not yet implemented`, {
      hint: "This feature is planned for a future phase",
    });
  }
}

export function isWienerError(e: unknown): e is WienerError {
  return e instanceof WienerError;
}

export function isWienerLike(e: unknown): e is WienerError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as Record<string, unknown>)["code"] === "string" &&
    typeof (e as Record<string, unknown>)["message"] === "string"
  );
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
        ...(e.details && typeof e.details === "object"
          ? { details: e.details as Record<string, unknown> }
          : {}),
      },
    };
  }
  const message = e instanceof Error ? e.message : String(e);
  return {
    ok: false,
    error: { code: "network-error", message },
  };
}
