// PHASE A WILL REPLACE: Course resolver stub — Phase A provides real fuzzy scoring + alias lookup

import type { Course, Resolution, ResolverOptions } from "../../types/course.js";
import { fuzzyScore } from "./fuzzy-score.js";

export function resolveCourse(
  input: string,
  courses: Course[],
  options: ResolverOptions = {}
): Resolution {
  const normalInput = input.toLowerCase().replace(/\s+/g, " ").trim();

  // 1. Exact match on code or alias
  for (const course of courses) {
    const matchesCode = course.code.toLowerCase() === normalInput;
    const matchesAlias = course.alias.toLowerCase() === normalInput;
    if (matchesCode || matchesAlias) {
      return {
        kind: "exact",
        course,
        matchedOn: matchesCode ? "code" : "alias",
      };
    }
  }

  if (options.exact) {
    return { kind: "no-match", closest: [] };
  }

  // 2. Substring match (≥3 chars)
  if (normalInput.length >= 3) {
    const substringMatches = courses.filter((c) => {
      const code = c.code.toLowerCase();
      const name = c.name.toLowerCase();
      const alias = c.alias.toLowerCase();
      return code.includes(normalInput) || name.includes(normalInput) || alias.includes(normalInput);
    });
    if (substringMatches.length === 1 && substringMatches[0]) {
      return { kind: "exact", course: substringMatches[0], matchedOn: "code" };
    }
    if (substringMatches.length > 1) {
      const scored = substringMatches.map((c) => ({ course: c, score: 0.9 }));
      return { kind: "ambiguous", candidates: scored };
    }
  }

  // 3. Fuzzy scoring
  const scored = courses
    .map((course) => ({
      course,
      score: Math.max(
        fuzzyScore(normalInput, course.code.toLowerCase()),
        fuzzyScore(normalInput, course.name.toLowerCase()),
        fuzzyScore(normalInput, course.alias.toLowerCase())
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  if (!top || top.score < 0.3) {
    return { kind: "no-match", closest: scored.slice(0, 5) };
  }

  const delta = top.score - (second?.score ?? 0);
  if (top.score > 0.85 && delta > 0.3) {
    const noInput = options.noInput ?? !process.stdin.isTTY;
    if (noInput && top.score <= 0.92) {
      return {
        kind: "ambiguous",
        candidates: scored.slice(0, 3),
      };
    }
    return {
      kind: "unique-fuzzy",
      course: top.course,
      score: top.score,
      suggested: true,
    };
  }

  const highScorers = scored.filter((s) => s.score > 0.5);
  if (highScorers.length >= 2) {
    return { kind: "ambiguous", candidates: highScorers.slice(0, 5) };
  }
  if (top.score >= 0.5) {
    return { kind: "unique-fuzzy", course: top.course, score: top.score, suggested: false };
  }

  return { kind: "no-match", closest: scored.slice(0, 5) };
}
