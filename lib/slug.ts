export function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function appendSlugSuffix(slug: string, suffix: string | number) {
  return `${slug}-${String(suffix).toLowerCase()}`;
}
