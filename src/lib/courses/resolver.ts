// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import type { Course, Resolution, ResolverOptions } from "../../../src/types/course.ts";
import { fuzzyScore } from "./fuzzy-score.ts";
import { stripAccents } from "./auto-alias.ts";

const DEFAULT_OPTS: Required<ResolverOptions> = {
  fuzzyConfirmThreshold: 0.85,
  fuzzyUniqueDelta: 0.30,
  noInputAutoThreshold: 0.92,
  noMatchTopN: 5,
  exact: false,
  noInput: false,
};

export function resolveCourse(
  input: string,
  courses: Course[],
  options: ResolverOptions = {},
): Resolution {
  const opts = { ...DEFAULT_OPTS, ...options };
  const q = stripAccents(input.toLowerCase().trim());

  if (!q) {
    return { kind: "no-match", closest: [] };
  }

  // 1. Exact match on code or alias
  for (const course of courses) {
    const code = course.course_code.toLowerCase();
    const alias = course.alias?.toLowerCase() ?? "";
    if (code === q || alias === q) {
      return { kind: "exact", course, matchedOn: alias === q ? "alias" : "code" };
    }
  }

  if (opts.exact) {
    return { kind: "no-match", closest: [] };
  }

  // 2. Substring match (≥3 chars)
  if (q.length >= 3) {
    const subMatches = courses.filter((c) => {
      const code = stripAccents(c.course_code.toLowerCase());
      const name = stripAccents(c.name.toLowerCase());
      const alias = stripAccents(c.alias?.toLowerCase() ?? "");
      return code.includes(q) || name.includes(q) || alias.includes(q);
    });

    if (subMatches.length === 1 && subMatches[0]) {
      return { kind: "exact", course: subMatches[0], matchedOn: "code" };
    }
    if (subMatches.length > 1) {
      const scored = subMatches.map((c) => ({ course: c, score: fuzzyScore(q, c) }));
      scored.sort((a, b) => b.score - a.score);
      return { kind: "ambiguous", candidates: scored };
    }
  }

  // 3. Fuzzy
  const scored = courses
    .map((c) => ({ course: c, score: fuzzyScore(q, c) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  if (!top || top.score < 0.3) {
    return { kind: "no-match", closest: scored.slice(0, opts.noMatchTopN) };
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

  if (top.score >= 0.5) {
    return { kind: "ambiguous", candidates: scored.slice(0, opts.noMatchTopN) };
  }

  return { kind: "no-match", closest: scored.slice(0, opts.noMatchTopN) };
}
