export interface SearchField<T> {
  getValue: (item: T) => string | undefined | null
  weight: number
}

export interface ParsedQuery {
  tokens: string[]
  filters: Record<string, string>
}

export function parseQuery(raw: string): ParsedQuery {
  const filters: Record<string, string> = {}
  let text = raw

  const pattern = /(\w+):(\S+)/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(raw)) !== null) {
    filters[m[1].toLowerCase()] = m[2].toLowerCase()
    text = text.replace(m[0], '')
  }

  return {
    tokens: text.trim().toLowerCase().split(/\s+/).filter(Boolean),
    filters,
  }
}

function scoreToken(text: string, token: string): number {
  const t = text.toLowerCase()
  const q = token

  if (t === q) return 1.0
  if (t.startsWith(q)) return 0.85
  if (t.includes(q)) return 0.7

  // Fuzzy: all chars appear in order with proximity scoring
  let qi = 0
  let lastIdx = -1
  let consecutive = 0
  let maxConsec = 0

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      consecutive = lastIdx === ti - 1 ? consecutive + 1 : 1
      maxConsec = Math.max(maxConsec, consecutive)
      lastIdx = ti
      qi++
    }
  }

  if (qi < q.length) return 0
  return Math.min(0.55, (q.length / t.length) * (maxConsec / q.length) * 0.7)
}

function itemScore<T>(item: T, tokens: string[], fields: SearchField<T>[]): number {
  if (tokens.length === 0) return 1

  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const field of fields) {
      const val = field.getValue(item)
      if (!val) continue
      best = Math.max(best, scoreToken(val, token) * field.weight)
    }
    if (best === 0) return 0
    total += best
  }
  return total / tokens.length
}

export function smartFilter<T>(
  items: T[],
  query: string,
  fields: SearchField<T>[],
  minScore = 0.25,
): T[] {
  const { tokens } = parseQuery(query)
  if (tokens.length === 0) return items

  return items
    .map((item) => ({ item, score: itemScore(item, tokens, fields) }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
