import { shouldWrapPastedTextAsFile } from '../hooks/useFileAttachments';

export interface LargeInsertion {
  /** The block of text that appeared in one go. */
  inserted: string;
  /** What the field should hold once that block is taken out. */
  remaining: string;
}

/**
 * Android keyboards (Gboard's clipboard strip, "paste" from the suggestion bar)
 * commit pasted text straight into the field without firing a `paste` event,
 * so the paste handler never sees it. Typing adds a character or two at a
 * time; a big jump in one change is a paste. Find that block by diffing the
 * old and new value.
 */
export function extractLargeInsertion(prev: string, next: string): LargeInsertion | null {
  if (next.length <= prev.length) return null;

  let start = 0;
  const maxStart = Math.min(prev.length, next.length);
  while (start < maxStart && prev[start] === next[start]) start++;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  const inserted = next.slice(start, endNext);
  if (!shouldWrapPastedTextAsFile(inserted)) return null;
  return { inserted, remaining: next.slice(0, start) + next.slice(endNext) };
}
