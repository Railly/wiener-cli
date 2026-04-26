// --fields projection: filter top-level keys from a data object

export function projectFields<T extends Record<string, unknown>>(
  data: T,
  fields: string | undefined
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
