/**
 * Diff visuel entre versions d'un article (§11.2 panneau Relecture :
 * « historique des versions avec diff visuel et restauration »).
 *
 * Diff mot à mot sans dépendance (algorithme LCS classique, borné à
 * 4 000 mots par version pour éviter les exploisons de complexité).
 */

export interface DiffToken {
  value: string;
  kind: "same" | "added" | "removed";
}

function tokenize(text: string): string[] {
  return (text.match(/\S+|\s+/g) ?? []).slice(0, 8000);
}

/** Diff mot à mot de deux textes plats (LCS programmatique dynamique). */
export function wordDiff(a: string, b: string): DiffToken[] {
  const A = tokenize(a).slice(0, 4000);
  const B = tokenize(b).slice(0, 4000);
  const n = A.length;
  const m = B.length;

  // LCS table — n, m ≤ 4000 → 16 M cellules max en Int16Array ≈ 32 Mo, acceptable.
  const dp = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] =
        A[i] === B[j]
          ? dp[at(i + 1, j + 1)] + 1
          : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)]);
    }
  }

  const tokens: DiffToken[] = [];
  const push = (value: string, kind: DiffToken["kind"]) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.value += value;
    else tokens.push({ value, kind });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push(A[i], "same");
      i += 1;
      j += 1;
    } else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) {
      push(A[i], "removed");
      i += 1;
    } else {
      push(B[j], "added");
      j += 1;
    }
  }
  while (i < n) {
    push(A[i], "removed");
    i += 1;
  }
  while (j < m) {
    push(B[j], "added");
    j += 1;
  }

  return tokens.filter((t) => t.value.trim().length > 0 || t.kind !== "same");
}

/** Statistiques de comparaison entre deux instantanés de version. */
export function diffStats(
  before: { title: string; plainText: string },
  after: { title: string; plainText: string }
): { wordsAdded: number; wordsRemoved: number; titleChanged: boolean } {
  const tokens = wordDiff(before.plainText, after.plainText);
  let wordsAdded = 0;
  let wordsRemoved = 0;
  for (const t of tokens) {
    const words = t.value.trim().split(/\s+/).filter(Boolean).length;
    if (t.kind === "added") wordsAdded += words;
    if (t.kind === "removed") wordsRemoved += words;
  }
  return {
    wordsAdded,
    wordsRemoved,
    titleChanged: before.title !== after.title,
  };
}
