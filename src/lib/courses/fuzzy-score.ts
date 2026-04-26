// Hand-rolled fuzzy scorer — no external dependencies
// Returns 0..1 score. Bonuses: substring (+0.4), consecutive run (+0.2),
// acronym match (+0.15), starts-with (+0.1), accent-folded (+0.05)

function foldAccents(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function isAcronymMatch(query: string, target: string): boolean {
  const words = target.split(/\s+/);
  const initials = words.map((w) => w[0] ?? "").join("").toLowerCase();
  return initials.startsWith(query.toLowerCase());
}

export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;
  if (query === target) return 1;

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const qFolded = foldAccents(q);
  const tFolded = foldAccents(t);

  let score = 0;

  // Exact folded match
  if (qFolded === tFolded) return 1;

  // Substring bonus (+0.4)
  if (t.includes(q) || tFolded.includes(qFolded)) {
    score += 0.4;
    // Starts-with bonus (+0.1)
    if (t.startsWith(q) || tFolded.startsWith(qFolded)) score += 0.1;
  }

  // Acronym match bonus (+0.15)
  if (isAcronymMatch(q, t) || isAcronymMatch(qFolded, tFolded)) {
    score += 0.15;
  }

  // Consecutive char run matching
  let qi = 0;
  let lastMatchPos = -1;
  let consecutiveRun = 0;
  let maxRun = 0;
  let charMatchCount = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi] || tFolded[ti] === qFolded[qi]) {
      charMatchCount++;
      if (lastMatchPos === ti - 1) {
        consecutiveRun++;
        maxRun = Math.max(maxRun, consecutiveRun);
      } else {
        consecutiveRun = 1;
      }
      lastMatchPos = ti;
      qi++;
    }
  }

  // All query chars matched
  if (qi === q.length) {
    const charRatio = charMatchCount / t.length;
    score += charRatio * 0.3;
    // Consecutive run bonus (+0.2 scaled by run length)
    if (maxRun > 1) {
      score += Math.min(0.2, maxRun / q.length * 0.2);
    }
  }

  // Accent-folded partial match bonus (+0.05)
  if (score > 0 && tFolded.includes(qFolded)) {
    score += 0.05;
  }

  return Math.min(1, score);
}
