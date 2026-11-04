import "server-only";

/** Split text into ~1200-char chunks on paragraph/sentence boundaries, with small overlap. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "));
      if (breakAt > size * 0.5) end = start + breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}
