// Spec 079, D-103: the character once written «Bobbidi» is «Babidi». His code
// comes from the name (`bobbidi` → `babidi`), so what a browser saved before
// is rewritten once, when the database opens in version 12.

/** The text with the old spelling replaced, in names and in codes. */
export function renameBabidiText(text: string): string {
  return text.replace(/Bobbidi/g, 'Babidi').replace(/bobbidi/g, 'babidi');
}

/**
 * The same value with every text and every key rewritten. Pictures stored in
 * the lists (`data:` addresses) are long and are left as they are.
 */
export function renameBabidi<T>(value: T): T {
  return rewrite(value) as T;
}

function rewrite(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('data:') ? value : renameBabidiText(value);
  }
  if (Array.isArray(value)) {
    return value.map(rewrite);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [renameBabidiText(key), rewrite(inner)]),
    );
  }
  return value;
}
