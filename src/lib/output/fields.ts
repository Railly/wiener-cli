export function applyFields(
  data: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  if (fields.length === 0) return data;

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const parts = field.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (current !== null && typeof current === "object" && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) {
      result[field] = current;
    }
  }
  return result;
}

export function parseFields(fieldsFlag: string | undefined): string[] {
  if (!fieldsFlag) return [];
  return fieldsFlag
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

export function projectFields<T extends Record<string, unknown>>(
  data: T,
  fields: string | undefined,
): Partial<T> {
  if (!fields) return data;
  const keys = fields.split(",").map((k) => k.trim());
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in data) {
      result[key as keyof T] = data[key as keyof T];
    }
  }
  return result;
}
