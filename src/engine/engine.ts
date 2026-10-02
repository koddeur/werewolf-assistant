import { narrate } from './narration'
import { defaultOrder, getRole, hasConfiguredEffect, hasEffect, ROLES, VILLAGER_ID } from './roles'
import {
  alivePlayers,
  availableActions,
  displayName,
  firstWolfToLeft,
  foxGroup,
  hasCircle,
  isWolf,
  playerById,
  playerByName,
  remainingSlots,
  roleName,
  rolesInGame,
  stepActors,
} from './selectors'
import { checkVictory, WINNER_LABELS } from './victory'
import type {
  Alert,
  DeathCause,
  GameAction,
  GameConfig,
  GameState,
  NightState,
  NightStep,
  Player,
  RoleId,
  SelectionValue,
  VoteResult,
  Winner,
} from './types'

type AlertInput = Alert extends infer A ? (A extends Alert ? Omit<A, 'id'> : never) : never

// ---------------------------------------------------------------------------
// Création de partie
// ---------------------------------------------------------------------------

export function createGame(config: GameConfig, names: string[] = [], seed = Date.now()): GameState {
  const order = [...config.order, ...defaultOrder().filter((id) => !config.order.includes(id))]
  const s: GameState = {
    version: 1,
    seed,
    seq: 0,
    config: { ...config, order },
    players: [],
    phase: 'nuit',
    turn: 1,
    night: null,
    morning: null,
    day: null,
    alerts: [],
    lovers: null,
    mayorId: null,
    wildChild: { modelId: null, modelDied: false },
    powers: {
      witchLife: true,
      witchDeath: true,
      infection: true,
      foxLost: false,
      guardLastId: null,
      ravenTargetId: null,
      wolfHasDied: false,
      elderHitIds: [],
      idiotRevealedIds: [],
      villagePowersLost: false,
      rustyTargetId: null,
      votesHeld: 0,
    },
    winner: null,
    log: [],
  }
  names.forEach((name, i) => {
    s.players.push(newPlayer(s, name.trim(), config.nameMode === 'cercle' ? i : null))
  })
  s.night = newNight(s, 1)
  log(s, `Début de la partie : ${config.playerCount} joueurs.`)
  return s
}

function newPlayer(s: GameState, name: string, seat: number | null = null): Player {
  s.seq += 1
  return {
    id: `p${s.seq}`,
    name,
    roleId: null,
    seat,
    alive: true,
    infected: false,
    turnedWolf: false,
    charmed: false,
  }
}

const nextId = (s: GameState) => `a${++s.seq}`

function log(s: GameState, text: string) {
  s.log.push({ turn: s.turn, phase: s.phase, text })
}

function pushAlert(s: GameState, out: Alert[], alert: AlertInput) {
  out.push({ ...alert, id: nextId(s) } as Alert)
}

// ---------------------------------------------------------------------------
// Construction des étapes de nuit
// ---------------------------------------------------------------------------

/** Variante « Nouveaux Amoureux » : le couple est mort et Cupidon est en vie. */
function cupidRenews(s: GameState, roleId: string): boolean {
  return (
    hasConfiguredEffect(s.config, roleId, 'renouvelle_amoureux') &&
    !!s.lovers &&
    s.lovers.every((id) => !playerById(s, id)?.alive) &&
    s.players.some((p) => p.alive && p.roleId === roleId)
  )
}

export function buildNightSteps(s: GameState, n: number): NightStep[] {
  const inGame = new Set(rolesInGame(s.config).map((r) => r.id))
  const hasPack = ROLES.some((r) => r.estLoup && inGame.has(r.id))
  const steps: NightStep[] = []
  const deferred: NightStep[] = []
  for (const roleId of s.config.order) {
    const role = getRole(roleId)
    if (!(role.meute ? hasPack : inGame.has(roleId))) continue
    const renewsLovers = n > 1 && cupidRenews(s, roleId)
    if (role.frequence === 'premiere_nuit' && n !== 1 && !renewsLovers) continue
    if (role.frequence === 'une_nuit_sur_deux' && n % 2 !== 0) continue
    if (role.frequence === 'jamais_la_nuit' && !(role.identificationNuit1 && n === 1)) continue
    if (n === 1 && role.apresReconnaissance) {
      // Tour de reconnaissance : il se montre maintenant et agit en fin de nuit.
      steps.push({ key: `${roleId}:reconnaissance`, kind: 'reconnaissance', roleId })
      deferred.push({ key: roleId, kind: 'role', roleId })
      continue
    }
    steps.push({ key: roleId, kind: 'role', roleId })
    if (role.compagnon?.id === 'amoureux' && (n === 1 || renewsLovers)) {
      steps.push({ key: `${roleId}:amoureux`, kind: 'amoureux', roleId })
    }
    if (role.compagnon?.id === 'charmes') {
      const piperAlive = n === 1 || s.players.some((p) => p.alive && p.roleId === roleId)
      if (piperAlive) steps.push({ key: `${roleId}:charmes`, kind: 'charmes', roleId })
    }
  }
  if (n === 1) steps.push({ key: 'villageois', kind: 'villageois', roleId: VILLAGER_ID }, ...deferred)
  return steps
}

function newNight(s: GameState, n: number): NightState {
  return {
    number: n,
    introDone: false,
    steps: buildNightSteps(s, n),
    index: 0,
    protectedId: null,
    wolfVictimId: null,
    infection: false,
    gmlVictimId: null,
    lbVictimId: null,
    savedId: null,
    poisonedId: null,
  }
}

export const currentStep = (s: GameState): NightStep | undefined => s.night?.steps[s.night.index]

// ---------------------------------------------------------------------------
// Identification des joueurs
// ---------------------------------------------------------------------------

function ensurePlayer(s: GameState, name: string): Player | undefined {
  const existing = playerByName(s, name)
  if (existing) return existing
  if (!name.trim() || s.players.length >= s.config.playerCount) return undefined
  const p = newPlayer(s, name.trim())
  s.players.push(p)
  return p
}

function assignRole(s: GameState, p: Player, roleId: RoleId) {
  if (p.roleId === roleId) return
  if (p.roleId !== null || !remainingSlots(s)[roleId]) return
  p.roleId = roleId
  log(s, `${p.name} est ${roleName(roleId)}.`)
}

// ---------------------------------------------------------------------------
// Morts et conséquences en chaîne
// ---------------------------------------------------------------------------

const VILLAGE_KILLS: DeathCause[] = ['vote', 'poison', 'chasseur']
const WOLF_ATTACKS: DeathCause[] = ['loups', 'grand_mechant_loup', 'loup_blanc']

export const DEATH_LABELS: Record<DeathCause, string> = {
  loups: 'dévoré(e) par les loups',
  grand_mechant_loup: 'dévoré(e) par le Grand Méchant Loup',
  loup_blanc: 'dévoré(e) par le Loup Blanc',
  poison: 'empoisonné(e) par la Sorcière',
  vote: 'éliminé(e) par le vote du village',
  chagrin: 'mort(e) de chagrin',
  chasseur: 'abattu(e) par le Chasseur',
  tetanos: 'mort(e) du tétanos',
  manuel: 'retiré(e) par le narrateur',
}

/**
 * Tue un joueur et empile dans `out` les écrans de conséquence, dans l'ordre :
 * annonce, successeur du Maire, chagrin de l'Amoureux, tir du Chasseur.
 */
export function killPlayer(s: GameState, id: string, cause: DeathCause, out: Alert[], announce = true) {
  const p = playerById(s, id)
  if (!p || !p.alive) return
  p.alive = false
  p.death = { turn: s.turn, phase: s.phase, cause }
  log(s, `${p.name} (${roleName(p.roleId)}) est ${DEATH_LABELS[cause]}.`)
  if (announce) pushAlert(s, out, { kind: 'death', playerId: id, cause })

  if (isWolf(p)) s.powers.wolfHasDied = true
  if (s.wildChild.modelId === id) s.wildChild.modelDied = true

  if (hasEffect(p.roleId, 'survit_premiere_attaque') && VILLAGE_KILLS.includes(cause) && !s.powers.villagePowersLost) {
    s.powers.villagePowersLost = true
    log(s, 'Le village a tué l’Ancien : les villageois perdent leurs pouvoirs.')
    pushAlert(s, out, {
      kind: 'info',
      level: 'danger',
      emoji: '👴',
      title: 'Le village a tué l’Ancien !',
      text: 'Tous les villageois perdent leurs pouvoirs spéciaux jusqu’à la fin de la partie. Annonce-le au village.',
    })
  }

  if (hasEffect(p.roleId, 'tetanos') && WOLF_ATTACKS.includes(cause)) {
    if (hasCircle(s)) {
      const wolf = firstWolfToLeft(s, id)
      if (wolf) {
        s.powers.rustyTargetId = wolf.id
        log(s, `L’épée rouillée du Chevalier a blessé ${wolf.name}.`)
        pushAlert(s, out, {
          kind: 'info',
          level: 'warning',
          emoji: '🗡️',
          title: `L’épée rouillée a blessé ${wolf.name}`,
          text: `${wolf.name} est le premier loup à gauche du Chevalier. Il mourra du tétanos la nuit prochaine. Ne dis rien pour l’instant.`,
        })
      }
    } else if (alivePlayers(s).some(isWolf)) {
      pushAlert(s, out, { kind: 'knight_target', knightId: id })
    }
  }

  if (s.mayorId === id) {
    s.mayorId = null
    if (alivePlayers(s).length > 0) pushAlert(s, out, { kind: 'mayor_successor', deadMayorId: id })
  }

  if (s.lovers?.includes(id)) {
    const otherId = s.lovers[0] === id ? s.lovers[1] : s.lovers[0]
    if (playerById(s, otherId)?.alive) killPlayer(s, otherId, 'chagrin', out, true)
    else {
      // Second Amoureux à mourir : le couple est éteint.
      const cupid = ROLES.find((r) => r.compagnon?.id === 'amoureux' && cupidRenews(s, r.id))
      if (cupid) {
        log(s, 'Les deux Amoureux sont morts : Cupidon désignera un nouveau couple la nuit prochaine.')
        pushAlert(s, out, {
          kind: 'info',
          level: 'info',
          emoji: '💘',
          title: 'Les deux Amoureux sont morts.',
          text: 'Cupidon est toujours en vie : la nuit prochaine, il désignera un nouveau couple. Ne dis rien au village.',
        })
      }
    }
  }

  if (hasEffect(p.roleId, 'tir_a_la_mort') && !s.powers.villagePowersLost && alivePlayers(s).length > 0) {
    pushAlert(s, out, { kind: 'hunter_shot', hunterId: id })
  }
}

// ---------------------------------------------------------------------------
// Actions de nuit
// ---------------------------------------------------------------------------

const asIds = (v: SelectionValue): string[] => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])

function applyStep(s: GameState, step: NightStep, selections: Record<string, SelectionValue>) {
  const night = s.night!
  const actors = stepActors(s, step)
  for (const action of availableActions(s, step)) {
    const value = selections[action.id]
    if (value === undefined || value === null) continue
    const ids = asIds(value)
    const first = ids[0] ?? null
    switch (action.effet) {
      case 'amour':
        if (ids.length === 2) {
          const renewal = s.lovers !== null
          s.lovers = [ids[0], ids[1]]
          log(s, `Cupidon unit ${renewal ? 'un nouveau couple : ' : ''}${displayName(s, ids[0])} et ${displayName(s, ids[1])}.`)
        }
        break
      case 'modele':
        s.wildChild.modelId = first
        log(s, `L’Enfant sauvage choisit ${displayName(s, first)} comme modèle.`)
        break
      case 'camp_chien_loup':
        for (const a of actors) a.turnedWolf = value === 'loups'
        log(s, `Le Chien-loup choisit le camp ${value === 'loups' ? 'des Loups-Garous' : 'du Village'}.`)
        break
      case 'flair': {
        if (!first) break
        const group = foxGroup(s, first)
        const found = group.some(isWolf)
        log(s, `Le Renard flaire ${group.map((p) => p.name).join(', ')} : ${found ? 'OUI' : 'NON'}.`)
        if (!found) {
          s.powers.foxLost = true
          log(s, 'Le Renard perd définitivement son pouvoir.')
        }
        break
      }
      case 'protection':
        night.protectedId = first
        s.powers.guardLastId = first
        log(s, `Le Salvateur protège ${displayName(s, first)}.`)
        break
      case 'voyance': {
        const t = playerById(s, first)
        if (t) log(s, `La Voyante découvre que ${t.name} est ${roleName(t.roleId)}.`)
        break
      }
      case 'corbeau':
        s.powers.ravenTargetId = first
        log(s, `Le Corbeau accuse ${displayName(s, first)} (+2 voix).`)
        break
      case 'attaque_loups':
        night.wolfVictimId = first
        log(s, `Les loups attaquent ${displayName(s, first)}.`)
        break
      case 'infection':
        if (value === true && night.wolfVictimId) {
          night.infection = true
          s.powers.infection = false
          log(s, `L’Infect Père choisit d’infecter ${displayName(s, night.wolfVictimId)}.`)
        }
        break
      case 'attaque_grand_mechant_loup':
        night.gmlVictimId = first
        log(s, `Le Grand Méchant Loup attaque ${displayName(s, first)}.`)
        break
      case 'attaque_loup_blanc':
        night.lbVictimId = first
        log(s, `Le Loup Blanc attaque ${displayName(s, first)}.`)
        break
      case 'potion_vie':
        if (!first) break
        night.savedId = first
        s.powers.witchLife = false
        log(s, `La Sorcière sauve ${displayName(s, first)} avec sa potion de vie.`)
        break
      case 'potion_mort':
        if (!first) break
        night.poisonedId = first
        s.powers.witchDeath = false
        log(s, `La Sorcière empoisonne ${displayName(s, first)}.`)
        break
      case 'charme':
        for (const id of ids) {
          const p = playerById(s, id)
          if (p) p.charmed = true
        }
        if (ids.length) log(s, `Le Joueur de flûte charme ${ids.map((id) => displayName(s, id)).join(' et ')}.`)
        break
    }
  }
}

/** Calcule les morts de la nuit à partir de toutes les actions enregistrées. */
export function resolveNight(s: GameState) {
  const n = s.night!
  const deaths: { id: string; cause: DeathCause }[] = []

  const attack = (id: string | null, cause: DeathCause) => {
    const p = playerById(s, id)
    if (!p || !p.alive) return
    if (n.protectedId === p.id) {
      log(s, `${p.name} était protégé(e) par le Salvateur : l’attaque échoue.`)
      return
    }
    if (n.savedId === p.id) return
    if (hasEffect(p.roleId, 'survit_premiere_attaque') && !s.powers.elderHitIds.includes(p.id)) {
      s.powers.elderHitIds.push(p.id)
      log(s, `${p.name} (Ancien) survit à sa première attaque.`)
      return
    }
    deaths.push({ id: p.id, cause })
  }

  if (n.wolfVictimId && n.infection) {
    const p = playerById(s, n.wolfVictimId)!
    if (n.protectedId === p.id) {
      log(s, `${p.name} était protégé(e) : l’infection échoue.`)
    } else {
      p.infected = true
      log(s, `${p.name} est infecté(e) : il ou elle devient loup en secret.`)
    }
  } else {
    attack(n.wolfVictimId, 'loups')
  }
  attack(n.gmlVictimId, 'grand_mechant_loup')
  attack(n.lbVictimId, 'loup_blanc')
  if (n.poisonedId) deaths.push({ id: n.poisonedId, cause: 'poison' })
  if (s.powers.rustyTargetId) {
    deaths.push({ id: s.powers.rustyTargetId, cause: 'tetanos' })
    s.powers.rustyTargetId = null
  }

  s.phase = 'matin'
  const out: Alert[] = []
  const announced: string[] = []
  for (const d of deaths) {
    if (!playerById(s, d.id)?.alive) continue
    announced.push(d.id)
    killPlayer(s, d.id, d.cause, out, false)
  }
  s.morning = { deaths: announced, pendingAlerts: out }
}

// ---------------------------------------------------------------------------
// Vote
// ---------------------------------------------------------------------------

function endGame(s: GameState, winner: Winner) {
  s.winner = winner
  s.phase = 'fin'
  s.alerts = []
  log(s, `Fin de la partie : ${WINNER_LABELS[winner].title}`)
}

function voteEliminate(s: GameState, id: string, out: Alert[]) {
  const p = playerById(s, id)
  if (!p || !p.alive) return
  if (hasEffect(p.roleId, 'gagne_si_elimine_premier_vote') && s.powers.votesHeld === 1) {
    log(s, `${p.name} (Ange) est éliminé(e) au premier vote.`)
    endGame(s, 'ange')
    return
  }
  if (
    hasEffect(p.roleId, 'gracie_au_vote') &&
    !s.powers.idiotRevealedIds.includes(p.id) &&
    !s.powers.villagePowersLost
  ) {
    s.powers.idiotRevealedIds.push(p.id)
    log(s, `${p.name} est l’Idiot du village : gracié(e), il ou elle ne votera plus.`)
    pushAlert(s, out, {
      kind: 'info',
      level: 'warning',
      emoji: '🤪',
      title: `${p.name} est l’Idiot du village !`,
      text: 'Il révèle sa carte et reste en vie, mais il ne pourra plus jamais voter.',
    })
    return
  }
  const servant = alivePlayers(s).find((x) => hasEffect(x.roleId, 'prend_role_elimine'))
  if (servant && servant.id !== p.id && !s.lovers?.includes(servant.id) && !s.powers.villagePowersLost) {
    pushAlert(s, out, { kind: 'servant_choice', servantId: servant.id, targetId: p.id })
    return
  }
  killPlayer(s, id, 'vote', out, true)
}

function applyVote(s: GameState, result: VoteResult) {
  s.powers.votesHeld += 1
  s.powers.ravenTargetId = null
  s.day!.voteDone = true
  const out: Alert[] = []
  if (result.kind === 'none') {
    log(s, 'Le village n’élimine personne.')
    pushAlert(s, out, { kind: 'info', level: 'info', emoji: '🕊️', title: 'Personne n’est éliminé aujourd’hui.' })
  } else if (result.kind === 'tie') {
    const goat = alivePlayers(s).find((p) => hasEffect(p.roleId, 'elimine_si_egalite'))
    if (goat && !s.powers.villagePowersLost) {
      log(s, `Égalité : le Bouc émissaire (${goat.name}) est éliminé.`)
      pushAlert(s, out, {
        kind: 'info',
        level: 'warning',
        emoji: '🐐',
        title: `Égalité ! ${goat.name}, le Bouc émissaire, est éliminé.`,
        text: 'Avant de mourir, il désigne les joueurs qui auront le droit de voter demain.',
      })
      voteEliminate(s, goat.id, out)
    } else {
      log(s, 'Égalité : personne n’est éliminé.')
      pushAlert(s, out, { kind: 'info', level: 'info', emoji: '⚖️', title: 'Égalité : personne n’est éliminé.' })
    }
  } else {
    voteEliminate(s, result.id, out)
  }
  if (s.phase !== 'fin') s.alerts = [...out, ...s.alerts]
}

// ---------------------------------------------------------------------------
// Réducteur principal
// ---------------------------------------------------------------------------

/** Vérifie la victoire quand toutes les conséquences ont été traitées. */
function settle(s: GameState) {
  if (s.phase !== 'jour' || s.alerts.length > 0 || s.winner) return
  const winner = checkVictory(s)
  if (winner) endGame(s, winner)
}

function startNight(s: GameState) {
  s.turn += 1
  s.phase = 'nuit'
  s.day = null
  s.morning = null
  s.night = newNight(s, s.turn)
  const child = s.players.find((p) => p.alive && hasEffect(p.roleId, 'devient_loup_si_modele_meurt'))
  if (child && s.wildChild.modelDied && !child.turnedWolf) {
    child.turnedWolf = true
    log(s, `${child.name} (Enfant sauvage) devient Loup-Garou.`)
    pushAlert(s, s.alerts, {
      kind: 'info',
      level: 'danger',
      emoji: '🧒',
      title: `L’Enfant sauvage (${child.name}) devient Loup-Garou.`,
      text: `${narrate('transformation', s.seed, s.turn)} Son modèle est mort : il se réveillera désormais avec les loups.`,
    })
  }
}

function resolveAlert(s: GameState, targetId: string | null | undefined, accept: boolean | undefined) {
  const alert = s.alerts.shift()
  if (!alert) return
  const out: Alert[] = []
  switch (alert.kind) {
    case 'mayor_successor':
      if (targetId && playerById(s, targetId)?.alive) {
        s.mayorId = targetId
        log(s, `${displayName(s, targetId)} devient le nouveau Maire.`)
      }
      break
    case 'hunter_shot':
      if (targetId) {
        log(s, `Le Chasseur tire sur ${displayName(s, targetId)}.`)
        killPlayer(s, targetId, 'chasseur', out, true)
      }
      break
    case 'servant_choice':
      if (accept) {
        const servant = playerById(s, alert.servantId)!
        const target = playerById(s, alert.targetId)!
        const taken = target.roleId
        target.roleId = servant.roleId
        servant.roleId = taken
        log(s, `${servant.name} (Servante dévouée) prend le rôle de ${target.name} : ${roleName(taken)}.`)
        pushAlert(s, out, {
          kind: 'info',
          level: 'warning',
          emoji: '🧹',
          title: `${servant.name} devient ${roleName(taken)}.`,
          text: `${target.name} montre la carte Servante dévouée. ${servant.name} reprend son rôle en secret.`,
        })
      }
      killPlayer(s, alert.targetId, 'vote', out, true)
      break
    case 'knight_target':
      if (targetId) {
        s.powers.rustyTargetId = targetId
        log(s, `L’épée rouillée du Chevalier a blessé ${displayName(s, targetId)}.`)
      }
      break
    default:
      break
  }
  s.alerts = [...out, ...s.alerts]
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const s = structuredClone(state)
  switch (action.type) {
    case 'START_NIGHT_INTRO':
      if (s.night) s.night.introDone = true
      break

    case 'IDENTIFY':
      for (const [roleId, names] of Object.entries(action.names)) {
        for (const name of names) {
          const p = ensurePlayer(s, name)
          if (p) assignRole(s, p, roleId)
        }
      }
      break

    case 'ADD_PLAYER':
      ensurePlayer(s, action.name)
      break

    case 'REVEAL_ROLE': {
      const p = playerById(s, action.playerId)
      if (p) assignRole(s, p, action.roleId)
      break
    }

    case 'COMPLETE_STEP': {
      const step = currentStep(s)
      if (!step || s.phase !== 'nuit') break
      applyStep(s, step, action.selections)
      s.night!.index += 1
      if (s.night!.index >= s.night!.steps.length) resolveNight(s)
      break
    }

    case 'ACK_MORNING': {
      if (s.phase !== 'matin') break
      const pending = s.morning?.pendingAlerts ?? []
      s.phase = 'jour'
      s.morning = null
      s.day = { mayorDone: false, voteDone: false }
      const out: Alert[] = [...pending]
      if (s.players.some((p) => p.alive && hasEffect(p.roleId, 'grognement_ours'))) {
        pushAlert(s, out, { kind: 'bear' })
      }
      s.alerts = [...out, ...s.alerts]
      break
    }

    case 'RESOLVE_ALERT':
      resolveAlert(s, action.targetId, action.accept)
      break

    case 'ELECT_MAYOR':
      if (s.day) s.day.mayorDone = true
      if (action.playerId) {
        s.mayorId = action.playerId
        log(s, `${displayName(s, action.playerId)} est élu(e) Maire.`)
      }
      break

    case 'VOTE':
      if (s.phase === 'jour' && s.day && !s.day.voteDone) applyVote(s, action.result)
      break

    case 'START_NIGHT':
      if (s.phase === 'jour') startNight(s)
      break

    case 'SET_ORDER':
      s.config.order = action.order
      break

    case 'EDIT_PLAYER': {
      const p = playerById(s, action.id)
      if (!p) break
      const { patch } = action
      if (patch.name !== undefined && patch.name.trim()) p.name = patch.name.trim()
      if (patch.roleId !== undefined) p.roleId = patch.roleId
      if (patch.alive !== undefined) {
        p.alive = patch.alive
        if (patch.alive) delete p.death
        else p.death = { turn: s.turn, phase: s.phase, cause: 'manuel' }
      }
      if (patch.infected !== undefined) p.infected = patch.infected
      if (patch.charmed !== undefined) p.charmed = patch.charmed
      if (patch.turnedWolf !== undefined) p.turnedWolf = patch.turnedWolf
      if (patch.mayor !== undefined) s.mayorId = patch.mayor ? p.id : s.mayorId === p.id ? null : s.mayorId
      log(s, `Correction manuelle de ${p.name}.`)
      break
    }
  }
  settle(s)
  return s
}
