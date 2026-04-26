// PHASE A WILL REPLACE — stub; shape matches Phase A contract

import type { Course } from "../../../src/types/course.ts";
import { stripAccents } from "./auto-alias.ts";

export function fuzzyScore(query: string, course: Course): number {
  const q = stripAccents(query.toLowerCase());
  const targets = [
    stripAccents(course.course_code.toLowerCase()),
    stripAccents(course.name.toLowerCase()),
    stripAccents(course.alias?.toLowerCase() ?? ""),
  ];

  let best = 0;
  for (const target of targets) {
    const score = scoreAgainst(q, target);
    if (score > best) best = score;
  }
  return best;
}

function scoreAgainst(q: string, target: string): number {
  if (!target) return 0;
  if (q === target) return 1.0;

  let score = 0;

  // Substring presence bonus
  if (target.includes(q)) {
    score += 0.4;
    // starts-with bonus
    if (target.startsWith(q)) score += 0.1;
  }

  // Char-order match (subsequence) with consecutive-run bonus
  let qi = 0;
  let consecutiveRun = 0;
  for (let ti = 0; ti < target.length && qi < q.length; ti++) {
    if (q[qi] === target[ti]) {
      qi++;
      consecutiveRun++;
      score += 0.01 + consecutiveRun * 0.005;
    } else {
      consecutiveRun = 0;
    }
  }
  const charRatio = qi / q.length;
  score += charRatio * 0.2;

  // Acronym match — check if q matches initials of words in target
  const words = target.split(/\s+/);
  const acronym = words.map((w) => w[0] ?? "").join("");
  if (acronym.includes(q)) score += 0.15;

  return Math.min(score, 1.0);
}
