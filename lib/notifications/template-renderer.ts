export function renderTemplate(body: string, variables: Record<string, string | number | undefined>): string {
  let result = body;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  // Remove any remaining unresolved variables
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  return result.trim();
}
