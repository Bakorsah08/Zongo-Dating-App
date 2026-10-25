/** Patterns that suggest raw DB / server internals — never show these to users. */
const INTERNAL_HINTS =
  /violates|relation|column|sql|postgres|pgrst|jwt|rls|policy|constraint|duplicate key|uuid/i;

/**
 * Maps unknown errors to a short, user-facing string. Prefer generic copy when the
 * underlying message may leak implementation details.
 */
export function toUserSafeMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  let raw = '';
  if (typeof error === 'string') raw = error;
  else if (error instanceof Error) raw = error.message ?? '';
  else if (typeof error === 'object' && error !== null && 'message' in error) {
    raw = String((error as { message?: unknown }).message ?? '');
  }
  raw = raw.trim();
  if (!raw || raw.length > 200) return fallback;
  if (/failed to fetch/i.test(raw)) {
    return 'Cannot reach Supabase (project may be paused). Run npm run supabase:restore or restore the project in your Supabase dashboard, then try again.';
  }
  if (INTERNAL_HINTS.test(raw)) return fallback;
  return raw;
}
