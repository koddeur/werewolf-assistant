import { findRole, getRole, hasEffect, ROLES, VILLAGER_ID } from './roles'
import type { ActionDef, GameConfig, GameState, NightStep, Player, RoleDef, RoleId } from './types'

export const normalizeName = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function playerById(s: GameState, id: string | null | undefined): Player | undefined {
  return id ? s.players.find((p) => p.id === id) : undefined
}

export function playerByName(s: GameState, name: string): Player | undefined {
  const n = normalizeName(name)
  return s.players.find((p) => normalizeName(p.name) === n)
}

export const alivePlayers = (s: GameState) => s.players.filter((p) => p.alive)

export function isWolf(p: Player): boolean {
  return Boolean(findRole(p.roleId)?.estLoup) || p.infected || p.turnedWolf
}

export function displayName(s: GameState, id: string | null | undefined): string {
  return playerById(s, id)?.name ?? '?'
}

export function roleName(roleId: RoleId | null): string {
  return roleId ? getRole(roleId).nom : 'Rôle inconnu'
}

/** Nombre total de cartes par rôle, Simples Villageois compris. */
export function fullRoleCounts(config: GameConfig): Record<RoleId, number> {
  const counts: Record<RoleId, number> = {}
  let assigned = 0
  for (const [id, n] of Object.entries(config.roleCounts)) {
    if (n > 0 && id !== VILLAGER_ID) {
      counts[id] = n
      assigned += n
    }
  }
  counts[VILLAGER_ID] = Math.max(0, config.playerCount - assigned)
  return counts
}

/** Nom et phrases du rôle, au pluriel si plusieurs cartes sont en jeu. */
export function roleTexts(config: GameConfig, role: RoleDef) {
  const plural = (fullRoleCounts(config)[role.id] ?? 0) > 1
  return {
    nom: (plural && role.nom_pluriel) || role.nom,
    reveil: (plural && role.phrase_reveil_pluriel) || role.phrase_reveil,
    coucher: (plural && role.phrase_coucher_pluriel) || role.phrase_coucher,
  }
}

export function rolesInGame(config: GameConfig): RoleDef[] {
  const counts = fullRoleCounts(config)
  return ROLES.filter((r) => (counts[r.id] ?? 0) > 0)
}

/** Cartes pas encore attribuées à un joueur identifié. */
export function remainingSlots(s: GameState): Record<RoleId, number> {
  const counts = fullRoleCounts(s.config)
  for (const p of s.players) {
    if (p.roleId && counts[p.roleId] !== undefined) counts[p.roleId] -= 1
  }
  for (const id of Object.keys(counts)) if (counts[id] <= 0) delete counts[id]
  return counts
}

export const unassignedPlayers = (s: GameState) => s.players.filter((p) => p.roleId === null)

/** Rôles à identifier lors d'une étape de nuit. */
export function rolesToIdentify(s: GameState, step: NightStep): RoleId[] {
  const remaining = remainingSlots(s)
  if (step.kind === 'villageois') return Object.keys(remaining)
  if (step.kind !== 'role' && step.kind !== 'reconnaissance') return []
  const role = getRole(step.roleId)
  if (role.meute) {
    return ROLES.filter((r) => r.reveilAvecLoups && remaining[r.id]).map((r) => r.id)
  }
  return remaining[role.id] ? [role.id] : []
}

/** Joueurs vivants qui se réveillent pour cette étape. */
export function stepActors(s: GameState, step: NightStep): Player[] {
  const role = getRole(step.roleId)
  if (step.kind === 'role' && role.meute) return alivePlayers(s).filter(isWolf)
  if (step.kind === 'amoureux') return s.players.filter((p) => p.alive && s.lovers?.includes(p.id))
  if (step.kind === 'charmes') return alivePlayers(s).filter((p) => p.charmed)
  return alivePlayers(s).filter((p) => p.roleId === step.roleId)
}

export type StepStatus = 'identify' | 'dead' | 'power_lost' | 'active'

export function stepStatus(s: GameState, step: NightStep): StepStatus {
  if (rolesToIdentify(s, step).length > 0) return 'identify'
  if (step.kind !== 'role') return 'active'
  if (stepActors(s, step).length === 0) return 'dead'
  const role = getRole(step.roleId)
  if (role.camp === 'village' && role.actions.length > 0 && s.powers.villagePowersLost) return 'power_lost'
  if (hasEffect(role.id, 'perd_pouvoir_si_non') && s.powers.foxLost) return 'power_lost'
  if (role.actions.length > 0 && availableActions(s, step).length === 0) return 'power_lost'
  return 'active'
}

export function conditionMet(s: GameState, action: ActionDef): boolean {
  switch (action.disponibleSi) {
    case undefined:
      return true
    case 'potion_vie':
      return s.powers.witchLife
    case 'potion_mort':
      return s.powers.witchDeath
    case 'infection_disponible':
      return s.powers.infection && s.players.some((p) => p.alive && p.roleId === 'infect_pere')
    case 'grand_mechant_loup_actif':
      return !s.powers.wolfHasDied
  }
}

export function availableActions(s: GameState, step: NightStep): ActionDef[] {
  if (step.kind !== 'role') return []
  return getRole(step.roleId).actions.filter((a) => conditionMet(s, a))
}

/** Victimes des attaques de la nuit, déjà corrigées par la protection du Salvateur. */
export function nightVictims(s: GameState): string[] {
  const n = s.night
  if (!n) return []
  const ids = [n.infection ? null : n.wolfVictimId, n.gmlVictimId, n.lbVictimId]
  return [...new Set(ids)].filter(
    (id): id is string => !!id && id !== n.protectedId && !!playerById(s, id)?.alive,
  )
}

/** Joueurs proposés pour une action, en respectant ses contraintes. */
export function candidates(s: GameState, action: ActionDef, actorIds: string[]): Player[] {
  if (action.source === 'victimes_nuit') {
    return nightVictims(s).map((id) => playerById(s, id)!)
  }
  const c = action.contraintes ?? []
  return s.players.filter((p) => {
    if (c.includes('vivant') && !p.alive) return false
    if (c.includes('pas_soi_meme') && actorIds.includes(p.id)) return false
    if (c.includes('pas_meme_que_nuit_precedente') && s.powers.guardLastId === p.id) return false
    if (c.includes('pas_loup') && isWolf(p)) return false
    if (c.includes('loup') && !isWolf(p)) return false
    if (c.includes('non_charme') && p.charmed) return false
    if (c.includes('pas_victime_loups') && s.night?.wolfVictimId === p.id) return false
    return true
  })
}

/** Joueurs vivants dans l'ordre du cercle (sens des aiguilles d'une montre). */
function aliveCircle(s: GameState, includeId?: string): Player[] {
  return s.players
    .filter((p) => p.seat !== null && (p.alive || p.id === includeId))
    .sort((a, b) => a.seat! - b.seat!)
}

export function hasCircle(s: GameState): boolean {
  return s.players.length > 0 && s.players.every((p) => p.seat !== null)
}

/** Les deux voisins vivants (gauche, droite) d'un joueur. */
export function aliveNeighbors(s: GameState, id: string): Player[] {
  const circle = aliveCircle(s, id)
  const idx = circle.findIndex((p) => p.id === id)
  if (idx < 0 || circle.length < 2) return []
  const left = circle[(idx + 1) % circle.length]
  const right = circle[(idx - 1 + circle.length) % circle.length]
  return left.id === right.id ? [left] : [left, right]
}

/** Premier loup vivant à gauche d'un joueur (sens des aiguilles d'une montre). */
export function firstWolfToLeft(s: GameState, id: string): Player | undefined {
  const circle = aliveCircle(s, id)
  const idx = circle.findIndex((p) => p.id === id)
  if (idx < 0) return undefined
  for (let i = 1; i < circle.length; i++) {
    const p = circle[(idx + i) % circle.length]
    if (isWolf(p)) return p
  }
  return undefined
}

/** Groupe flairé par le Renard : la cible et ses deux voisins vivants. */
export function foxGroup(s: GameState, targetId: string): Player[] {
  const target = playerById(s, targetId)
  return target ? [target, ...aliveNeighbors(s, targetId)] : []
}

export function bearGrowls(s: GameState): { tamer: Player | undefined; growls: boolean } {
  const tamer = s.players.find((p) => p.alive && hasEffect(p.roleId, 'grognement_ours'))
  if (!tamer) return { tamer: undefined, growls: false }
  return { tamer, growls: isWolf(tamer) || aliveNeighbors(s, tamer.id).some(isWolf) }
}

export function playerBadges(s: GameState, p: Player): string[] {
  const badges: string[] = []
  if (s.mayorId === p.id) badges.push('👑 Maire')
  if (s.lovers?.includes(p.id)) badges.push('❤️ Amoureux')
  if (s.night?.protectedId === p.id && s.phase === 'nuit') badges.push('🛡️ Protégé')
  if (p.infected) badges.push('🐺 Infecté')
  if (p.turnedWolf) badges.push('🐺 Devenu loup')
  if (p.charmed) badges.push('🎶 Charmé')
  if (s.wildChild.modelId === p.id) badges.push('🧒 Modèle')
  if (s.powers.idiotRevealedIds.includes(p.id)) badges.push('🤪 Gracié (ne vote plus)')
  if (s.powers.ravenTargetId === p.id) badges.push('🐦‍⬛ +2 voix')
  return badges
}
