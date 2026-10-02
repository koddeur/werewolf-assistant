import { findRole, hasEffect } from './roles'
import { alivePlayers, isWolf, playerById } from './selectors'
import type { GameState, Player, Winner } from './types'

function campOf(p: Player): 'loups' | 'village' | 'solo' {
  if (isWolf(p)) return 'loups'
  const camp = findRole(p.roleId)?.camp
  return camp === 'solo' ? 'solo' : 'village'
}

/** Renvoie le camp gagnant, ou `null` si la partie continue. */
export function checkVictory(s: GameState): Winner | null {
  const alive = alivePlayers(s)
  if (alive.length === 0) return 'personne'

  if (s.lovers && alive.length === 2) {
    const [a, b] = s.lovers.map((id) => playerById(s, id)!)
    if (a.alive && b.alive && campOf(a) !== campOf(b)) return 'amoureux'
  }

  const piper = alive.find((p) => hasEffect(p.roleId, 'gagne_si_tous_charmes'))
  if (piper && alive.every((p) => p.id === piper.id || p.charmed)) return 'joueur_flute'

  const whiteWolf = alive.find((p) => hasEffect(p.roleId, 'gagne_seul'))
  if (whiteWolf && alive.length === 1) return 'loup_blanc'

  const wolves = alive.filter(isWolf)
  const others = alive.filter((p) => !isWolf(p))
  if (wolves.length === 0) return piper ? null : 'village'
  if (others.length === 0) return whiteWolf && wolves.length > 1 ? null : 'loups'
  return null
}

export const WINNER_LABELS: Record<Winner, { emoji: string; title: string }> = {
  village: { emoji: '🏡', title: 'Le Village gagne !' },
  loups: { emoji: '🐺', title: 'Les Loups-Garous gagnent !' },
  amoureux: { emoji: '❤️', title: 'Les Amoureux gagnent ensemble !' },
  ange: { emoji: '😇', title: 'L’Ange gagne la partie seul !' },
  joueur_flute: { emoji: '🪈', title: 'Le Joueur de flûte gagne seul !' },
  loup_blanc: { emoji: '🤍', title: 'Le Loup Blanc gagne seul !' },
  personne: { emoji: '💀', title: 'Personne ne gagne…' },
}
