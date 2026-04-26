import { fuzzyScore } from "./fuzzy-score.js";

export interface ResolvableItem {
  code: string;
  name: string;
  alias: string;
}

export type Resolution<T extends ResolvableItem = ResolvableItem> =
  | { kind: "exact"; course: T; matchedOn: "code" | "alias" }
  | { kind: "unique-fuzzy"; course: T; score: number; suggested: boolean }
  | { kind: "ambiguous"; candidates: Array<{ course: T; score: number }> }
  | { kind: "no-match"; closest: Array<{ course: T; score: number }> };

export interface ResolverOptions {
  exact?: boolean;
  noInput?: boolean;
  fuzzyConfirmThreshold?: number;
  fuzzyUniqueDelta?: number;
  noInputAutoThreshold?: number;
  noMatchTopN?: number;
}

const DEFAULT_OPTIONS: Required<ResolverOptions> = {
  exact: false,
  noInput: false,
  fuzzyConfirmThreshold: 0.85,
  fuzzyUniqueDelta: 0.3,
  noInputAutoThreshold: 0.92,
  noMatchTopN: 5,
};

function normalizeInput(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveCourse<T extends ResolvableItem>(
  input: string,
  courses: T[],
  options: ResolverOptions = {},
): Resolution<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const query = normalizeInput(input);

  // 1. Exact match on code or alias
  for (const course of courses) {
    if (!course.code) continue;
    if (course.code.toLowerCase() === query) {
      return { kind: "exact", course, matchedOn: "code" };
    }
    if (course.alias && course.alias.toLowerCase() === query) {
      return { kind: "exact", course, matchedOn: "alias" };
    }
  }

  if (opts.exact) {
    return { kind: "no-match", closest: [] };
  }

  // 2. Substring match (≥3 chars)
  if (query.length >= 3) {
    const substringMatches = courses.filter((c) => {
      if (!c.code) return false;
      const code = c.code.toLowerCase();
      const name = (c.name ?? "").toLowerCase();
      const alias = (c.alias ?? "").toLowerCase();
      return code.includes(query) || name.includes(query) || alias.includes(query);
    });

    if (substringMatches.length === 1 && substringMatches[0]) {
      return { kind: "exact", course: substringMatches[0], matchedOn: "code" };
    }

    if (substringMatches.length > 1) {
      const scored = substringMatches.map((c) => ({ course: c, score: 0.75 }));
      return { kind: "ambiguous", candidates: scored };
    }
  }

  // 3. Fuzzy scoring
  const scored = courses
    .filter((c) => !!c.code)
    .map((course) => {
      const codeScore = fuzzyScore(query, course.code ?? "");
      const nameScore = fuzzyScore(query, course.name ?? "");
      const aliasScore = fuzzyScore(query, course.alias ?? "");
      const score = Math.max(codeScore, nameScore, aliasScore);
      return { course, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  if (!top || top.score === 0) {
    return { kind: "no-match", closest: [] };
  }

  const delta = top.score - (second?.score ?? 0);
  const threshold = opts.noInput ? opts.noInputAutoThreshold : opts.fuzzyConfirmThreshold;

  if (top.score >= threshold && delta >= opts.fuzzyUniqueDelta) {
    return {
      kind: "unique-fuzzy",
      course: top.course,
      score: top.score,
      suggested: !opts.noInput,
    };
  }

  // Multiple high-score candidates
  const highScoreCandidates = scored.filter((s) => s.score >= 0.5);
  if (highScoreCandidates.length > 1) {
    return { kind: "ambiguous", candidates: highScoreCandidates };
  }

  // No clear winner
  if (top.score < 0.5) {
    return {
      kind: "no-match",
      closest: scored.slice(0, opts.noMatchTopN),
    };
  }

  return {
    kind: "no-match",
    closest: scored.slice(0, opts.noMatchTopN),
  };
}
