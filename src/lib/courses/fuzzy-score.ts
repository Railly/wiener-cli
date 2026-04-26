function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalize(s: string): string {
  return stripAccents(s.toLowerCase().trim());
}

function longestConsecutiveRun(needle: string, haystack: string): number {
  let maxRun = 0;
  let run = 0;
  let ni = 0;

  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      run++;
      ni++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 0;
    }
  }
  return maxRun;
}

function acronymScore(needle: string, haystack: string): number {
  const words = haystack.split(/\s+/).filter(Boolean);
  const acronym = words.map((w) => w[0] ?? "").join("");
  if (acronym.toLowerCase().startsWith(needle.toLowerCase())) return 0.15;
  if (acronym.toLowerCase().includes(needle.toLowerCase())) return 0.08;
  return 0;
}

function charOrderScore(needle: string, haystack: string): number {
  let score = 0;
  let hi = 0;
  let matched = 0;

  for (let ni = 0; ni < needle.length; ni++) {
    const nc = needle[ni];
    if (!nc) continue;
    for (; hi < haystack.length; hi++) {
      if (haystack[hi] === nc) {
        matched++;
        hi++;
        break;
      }
    }
  }

  if (needle.length > 0) {
    score = matched / needle.length;
  }

  return score * 0.3;
}

export function fuzzyScore(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;

  const n = normalize(needle);
  const h = normalize(haystack);

  if (n === h) return 1.0;

  let score = 0;

  // Substring bonus (+0.4)
  if (h.includes(n)) {
    score += 0.4;
  } else if (n.includes(h)) {
    score += 0.3;
  }

  // Consecutive char run bonus (+0.2)
  const runLen = longestConsecutiveRun(n, h);
  if (runLen >= 3) {
    score += Math.min(0.2, (runLen / n.length) * 0.2);
  }

  // Acronym bonus (+0.15)
  score += acronymScore(n, h);

  // Starts-with bonus (+0.1)
  if (h.startsWith(n) || n.startsWith(h)) {
    score += 0.1;
  }

  // Accent-folded bonus (+0.05) — already normalized above but reward if the
  // match only works after stripping accents
  const origN = needle.toLowerCase().trim();
  const origH = haystack.toLowerCase().trim();
  if (origN !== n || origH !== h) {
    if (h.includes(n) && !origH.includes(origN)) {
      score += 0.05;
    }
  }

  // Char order score
  score += charOrderScore(n, h);

  return Math.min(1, score);
}
