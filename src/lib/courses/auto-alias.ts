// PHASE A WILL REPLACE — stub; shape matches Phase A contract

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "del", "y", "e", "en", "a", "con", "por",
  "para", "al", "un", "una", "unos", "unas", "se", "su", "sus",
  "ii", "iii", "iv", "vi", "vii", "viii", "ix", "x",
  "i", "ii", "iii", "iv", "v",
]);

export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function generateAutoAlias(name: string, existing: Set<string> = new Set()): string {
  const clean = stripAccents(name.toLowerCase())
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  const tokens = clean.split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));

  if (tokens.length === 0) {
    const slug = stripAccents(name.toLowerCase()).replace(/[^a-z0-9]/g, "").slice(0, 10);
    return deduplicate(slug, existing);
  }

  const base = tokens[0] ?? "curso";

  if (!existing.has(base)) return base;

  // Try adding next significant token
  for (let i = 1; i < tokens.length; i++) {
    const candidate = `${base}${tokens[i]}`;
    if (!existing.has(candidate)) return candidate;
  }

  // Append counter
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}${n}`;
    if (!existing.has(candidate)) return candidate;
  }

  return base;
}

function deduplicate(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return base;
}
