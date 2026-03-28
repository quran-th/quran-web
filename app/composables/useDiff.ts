import { computed, type ComputedRef, type Ref } from "vue";

export type DiffType = "equal" | "insert" | "delete";

export interface DiffToken {
  type: DiffType;
  text: string;
}

const MARKER_RE = /\(\*\d+\*\)/g;

function tokenizeWithMarkers(text: string): string[] {
  const tokens: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MARKER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const between = text.slice(lastIndex, match.index);
      for (const char of between) {
        tokens.push(char);
      }
    }
    tokens.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    for (const char of remaining) {
      tokens.push(char);
    }
  }

  return tokens;
}

export function computeDiff(oldStr: string, newStr: string): DiffToken[] {
  const oldTokens = tokenizeWithMarkers(oldStr);
  const newTokens = tokenizeWithMarkers(newStr);
  const m = oldTokens.length;
  const n = newTokens.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        oldTokens[i - 1] === newTokens[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  const tokens: DiffToken[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      tokens.unshift({ type: "equal", text: oldTokens[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      tokens.unshift({ type: "insert", text: newTokens[j - 1]! });
      j--;
    } else {
      tokens.unshift({ type: "delete", text: oldTokens[i - 1]! });
      i--;
    }
  }

  return tokens.reduce<DiffToken[]>((acc, token) => {
    const last = acc[acc.length - 1];
    if (last && last.type === token.type) {
      last.text += token.text;
    } else {
      acc.push({ ...token });
    }
    return acc;
  }, []);
}

export function useDiff(
  currentTranslation: Ref<string>,
  proposalText: Ref<string>,
) {
  const diffTokens: ComputedRef<DiffToken[]> = computed(() => {
    const current = currentTranslation.value;
    const proposed = proposalText.value;
    if (!proposed.trim() || current === proposed) return [];
    const tokens = computeDiff(current, proposed);
    return tokens.every((t) => t.type === "equal") ? [] : tokens;
  });

  return { diffTokens };
}
