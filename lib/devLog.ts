/** Dev-only console logging; avoids noisy production logs while keeping local debugging. */
export function devError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.error(context, err);
  }
}
