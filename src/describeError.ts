/** What went wrong, in words for the director: an Error's message, otherwise the value itself. */
export function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
