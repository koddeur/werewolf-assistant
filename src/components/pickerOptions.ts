import { candidates, isWolf, nightVictims, playerById } from '../engine/selectors'
import type { ActionDef, Contrainte, GameState, Player } from '../engine/types'
import type { PickerOption } from './PlayerPicker'

const REASONS: Partial<Record<Contrainte, (s: GameState, p: Player, actorIds: string[]) => string | null>> = {
  pas_soi_meme: (_s, p, actorIds) => (actorIds.includes(p.id) ? 'C’est lui-même' : null),
  pas_meme_que_nuit_precedente: (s, p) => (s.powers.guardLastId === p.id ? '⛔ Protégé la nuit dernière' : null),
  pas_loup: (_s, p) => (isWolf(p) ? '🐺 Loup' : null),
  non_charme: (_s, p) => (p.charmed ? '🎶 Déjà charmé' : null),
  pas_victime_loups: (s, p) => (s.night?.wolfVictimId === p.id ? 'Déjà victime des loups' : null),
}

/**
 * Joueurs vivants à afficher pour une action : les choix valides sont actifs,
 * les autres sont grisés avec la raison (sauf contrainte « loup », qui masque).
 */
export function pickerOptions(s: GameState, action: ActionDef, actorIds: string[]): PickerOption[] {
  if (action.source === 'victimes_nuit') {
    return nightVictims(s).map((id) => ({ player: playerById(s, id)! }))
  }
  const valid = new Set(candidates(s, action, actorIds).map((p) => p.id))
  const contraintes = action.contraintes ?? []
  return s.players
    .filter((p) => p.alive && (!contraintes.includes('loup') || isWolf(p)))
    .map((p) => {
      if (valid.has(p.id)) return { player: p }
      const reason = contraintes.map((c) => REASONS[c]?.(s, p, actorIds)).find(Boolean)
      return { player: p, disabledReason: reason ?? 'Choix impossible' }
    })
}
