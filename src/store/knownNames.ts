import { normalizeName } from '../engine/selectors'

const KEY = 'werewolf-assistant:names'

/** Prénoms saisis lors des parties précédentes, pour l'autocomplétion. */
export function knownNames(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string') : []
  } catch {
    return []
  }
}

export function rememberNames(names: string[]) {
  const seen = new Set<string>()
  const merged = [...names, ...knownNames()].filter((n) => {
    const k = normalizeName(n)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(merged.slice(0, 200)))
  } catch {
    // Pas grave : ce n'est qu'une aide à la saisie.
  }
}

export function suggestNames(typed: string, exclude: Set<string>, pool: string[] = knownNames(), limit = 6): string[] {
  const t = normalizeName(typed)
  if (!t) return []
  return pool.filter((n) => !exclude.has(normalizeName(n)) && normalizeName(n).startsWith(t) && normalizeName(n) !== t).slice(0, limit)
}
