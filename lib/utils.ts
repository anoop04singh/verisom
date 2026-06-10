export function truncateMiddle(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function chunkText(text: string, size = 1800, overlap = 180) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = Math.min(text.length, cursor + size);
    chunks.push(text.slice(cursor, next).trim());
    if (next >= text.length) {
      break;
    }

    cursor = Math.max(0, next - overlap);
  }

  return chunks.filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function excerpt(text: string, maxLength = 220) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}…`;
}
