import { ParseError } from "../errors.js";

const CSRF_PATTERNS = [
  /csrfToken\s*=\s*['"]([A-F0-9a-f]{6,16})['"]/,
  /csrfToken:\s*['"]([A-F0-9a-f]{6,16})['"]/,
  /['"]csrfToken['"]\s*:\s*['"]([A-F0-9a-f]{6,16})['"]/,
];

export function extractCsrfToken(html: string): string {
  for (const pattern of CSRF_PATTERNS) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  throw new ParseError("csrfToken from sso.asp", {
    hint: "CSRF token pattern not found. Wiener may have changed the login page.",
  });
}
