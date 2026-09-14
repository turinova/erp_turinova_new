/** Max length for quotes.project_name (DB check + UI). */
export const PROJECT_NAME_MAX_LENGTH = 120

/**
 * Trim + empty→null. Returns error message if too long.
 */
export function normalizeProjectName(
  raw: string | null | undefined
): { value: string | null } | { error: string } {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return { value: null }
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return {
      error: `A projekt neve legfeljebb ${PROJECT_NAME_MAX_LENGTH} karakter lehet.`
    }
  }
  return { value: trimmed }
}
