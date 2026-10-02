import { findRole } from '../engine/roles'
import type { GameState, Player } from '../engine/types'

export function roleLabel(p: Player) {
  const role = findRole(p.roleId)
  const base = role ? `${role.emoji} ${role.nom}` : '❔ rôle inconnu'
  return p.infected || p.turnedWolf ? `${base} · 🐺` : base
}

/** Peut-on encore créer un joueur (mode progressif, nuit 1) ? */
export function canAddPlayers(s: GameState) {
  return s.config.nameMode === 'progressif' && s.players.length < s.config.playerCount
}
