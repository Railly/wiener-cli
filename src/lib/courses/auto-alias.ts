const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "o",
  "u",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "i",
  "para",
  "por",
  "con",
  "en",
  "a",
  "al",
]);

const SECTION_SUFFIXES = /[-\s]+(T|P1|P2|P3|PD|PE|L|P)\s*$/i;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalize(name: string): string {
  return stripAccents(name.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

function tokenize(name: string): string[] {
  return normalize(name)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function significantTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

function stripSectionSuffix(name: string): string {
  return name.replace(SECTION_SUFFIXES, "").trim();
}

function stripCodePrefix(name: string, code: string): string {
  const prefix = `${code} - `;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  const prefixNoSpace = `${code}-`;
  if (name.startsWith(prefixNoSpace)) return name.slice(prefixNoSpace.length);
  return name;
}

export function generateAutoAlias(name: string, existingAliases: Set<string> = new Set()): string {
  const cleanName = stripSectionSuffix(name);
  const tokens = tokenize(cleanName);
  const sigTokens = significantTokens(tokens);

  if (sigTokens.length === 0) {
    const base = normalize(cleanName).replace(/\s+/g, "").slice(0, 8) || "curso";
    return dedup(base, existingAliases);
  }

  const primary = sigTokens[0] ?? "curso";
  const candidate = dedup(primary, existingAliases);
  return candidate;
}

function dedup(base: string, existingAliases: Set<string>): string {
  if (!existingAliases.has(base)) return base;

  let counter = 2;
  while (existingAliases.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}

export function generateAliasMap(
  courses: Array<{ code: string; name: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  const codeToAlias: Array<{ code: string; name: string; alias: string }> = [];

  for (const course of courses) {
    if (!course.code) continue;
    const alias = generateAutoAlias(course.name ?? "", used);
    result[course.code] = alias;
    used.add(alias);
    codeToAlias.push({ code: course.code, name: course.name ?? "", alias });
  }

  for (const { code, name, alias } of codeToAlias) {
    const compositeKey = `${code}::${name.trim()}`;
    result[compositeKey] = alias;
  }

  return result;
}

export function generateAliasMapByCodeName(
  courses: Array<{ code: string; name: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<string>();
  const seenKeys = new Set<string>();

  for (const course of courses) {
    const cleanName = stripSectionSuffix(stripCodePrefix(course.name, course.code));
    const key = `${course.code}::${cleanName}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const alias = generateAutoAlias(cleanName, used);
    result[key] = alias;
    used.add(alias);
  }

  return result;
}
