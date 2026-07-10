// Damerau-Levenshtein distance (optimal string alignment): insertions,
// deletions, substitutions, and adjacent transpositions each cost 1.
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Never auto-correct short function words (ang, sa, ng, ...).
export function maxDistanceFor(word: string): number {
  if (word.length < 4) return 0;
  return word.length <= 5 ? 1 : 2;
}

// Best candidate within the word's distance threshold. Deterministic:
// lowest distance wins, ties break alphabetically. Returns null when the
// word is too short to correct or no candidate is close enough.
export function pickFuzzyMatch(word: string, candidates: string[]): string | null {
  const max = maxDistanceFor(word);
  if (max === 0) return null;
  let best: string | null = null;
  let bestDist = max + 1;
  for (const candidate of [...candidates].sort()) {
    if (candidate === word) continue;
    const dist = editDistance(word, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}
