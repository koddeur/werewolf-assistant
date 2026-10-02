import { describe, expect, it } from 'vitest'
import { createGame, currentStep, gameReducer } from './engine'
import { defaultOrder, getRole } from './roles'
import {
  bearGrowls,
  candidates,
  isWolf,
  nightVictims,
  playerByName,
  stepActors,
  stepStatus,
} from './selectors'
import type { GameAction, GameState, RoleId, SelectionValue } from './types'

type Selections = Record<string, SelectionValue>

/** Partie en placement en cercle, chaque joueur ayant déjà son rôle. */
function setup(seating: [name: string, role: RoleId][], opts: { mayor?: boolean } = {}): GameState {
  const roleCounts: Record<RoleId, number> = {}
  const names: Record<RoleId, string[]> = {}
  for (const [name, role] of seating) {
    if (role !== 'villageois') roleCounts[role] = (roleCounts[role] ?? 0) + 1
    ;(names[role] ??= []).push(name)
  }
  const s = createGame(
    { playerCount: seating.length, roleCounts, nameMode: 'cercle', mayorEnabled: opts.mayor ?? true, order: defaultOrder() },
    seating.map(([name]) => name),
    42,
  )
  return gameReducer(s, { type: 'IDENTIFY', names })
}

const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s)
const id = (s: GameState, name: string) => playerByName(s, name)!.id
const player = (s: GameState, name: string) => playerByName(s, name)!

/** Joue la nuit en cours : `inputs` est indexé par clé d'étape (id du rôle). */
function playNight(s: GameState, inputs: Record<string, Selections> = {}): GameState {
  s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
  while (s.phase === 'nuit' && s.alerts.length === 0) {
    const step = currentStep(s)!
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: inputs[step.key] ?? {} })
  }
  return s
}

/** Joue une nuit puis annonce le matin. */
function nightAndMorning(s: GameState, inputs: Record<string, Selections> = {}): GameState {
  return gameReducer(playNight(s, inputs), { type: 'ACK_MORNING' })
}

/** Passe le jour sans éliminer personne et commence la nuit suivante. */
function quietDay(s: GameState): GameState {
  s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'none' } })
  while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
  return gameReducer(s, { type: 'START_NIGHT' })
}

const BASE: [string, RoleId][] = [
  ['Alice', 'loup_garou'],
  ['Bob', 'salvateur'],
  ['Chloé', 'villageois'],
  ['David', 'loup_garou'],
  ['Emma', 'sorciere'],
  ['Farid', 'villageois'],
  ['Gaël', 'voyante'],
  ['Hugo', 'villageois'],
]

describe('Salvateur', () => {
  it('les loups qui attaquent le joueur protégé ne tuent personne', () => {
    let s = setup(BASE)
    s = playNight(s, {
      salvateur: { protege: [id(s, 'Chloé')] },
      loup_garou: { victime: [id(s, 'Chloé')] },
    })
    expect(s.phase).toBe('matin')
    expect(s.morning!.deaths).toEqual([])
    expect(player(s, 'Chloé').alive).toBe(true)
  })

  it('la Sorcière ne voit pas la victime protégée, donc ne gaspille pas sa potion', () => {
    let s = setup(BASE)
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    while (currentStep(s)!.roleId !== 'sorciere') {
      const key = currentStep(s)!.key
      const selections: Selections =
        key === 'salvateur' ? { protege: [id(s, 'Chloé')] } : key === 'loup_garou' ? { victime: [id(s, 'Chloé')] } : {}
      s = gameReducer(s, { type: 'COMPLETE_STEP', selections })
    }
    expect(nightVictims(s)).toEqual([])
    expect(stepStatus(s, currentStep(s)!)).toBe('active')
    expect(s.powers.witchLife).toBe(true)
  })

  it('ne peut pas protéger le même joueur deux nuits de suite, mais peut se protéger lui-même', () => {
    let s = setup(BASE)
    s = nightAndMorning(s, { salvateur: { protege: [id(s, 'Chloé')] } })
    s = quietDay(s)
    const action = getRole('salvateur').actions[0]
    const names = candidates(s, action, [id(s, 'Bob')]).map((p) => p.name)
    expect(names).not.toContain('Chloé')
    expect(names).toContain('Bob')
  })
})

describe('Enfant sauvage', () => {
  it('devient loup au début de la nuit suivant la mort de son modèle', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'enfant_sauvage']])
    s = nightAndMorning(s, {
      enfant_sauvage: { modele: [id(s, 'Chloé')] },
      loup_garou: { victime: [id(s, 'Chloé')] },
    })
    expect(player(s, 'Chloé').alive).toBe(false)
    expect(s.wildChild.modelDied).toBe(true)
    expect(isWolf(player(s, 'Hugo'))).toBe(false)

    s = quietDay(s)
    expect(s.alerts[0]).toMatchObject({ kind: 'info', title: expect.stringContaining('Hugo') })
    expect(isWolf(player(s, 'Hugo'))).toBe(true)
    s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    const pack = s.night!.steps.find((st) => st.roleId === 'loup_garou')!
    expect(stepActors(s, pack).map((p) => p.name)).toContain('Hugo')
  })
})

describe('Chasseur et Amoureux', () => {
  it('le Chasseur qui tue un Amoureux entraîne la mort de l’autre par chagrin', () => {
    let s = setup([...BASE.slice(0, 5), ['Farid', 'cupidon'], ['Gaël', 'chasseur'], ['Hugo', 'villageois']])
    s = nightAndMorning(s, {
      cupidon: { amoureux: [id(s, 'Chloé'), id(s, 'Hugo')] },
      loup_garou: { victime: [id(s, 'Gaël')] },
    })
    expect(s.alerts[0]).toMatchObject({ kind: 'hunter_shot', hunterId: id(s, 'Gaël') })
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Chloé') })
    expect(player(s, 'Chloé').alive).toBe(false)
    expect(player(s, 'Hugo').alive).toBe(false)
    expect(player(s, 'Hugo').death!.cause).toBe('chagrin')
    expect(s.alerts.map((a) => a.kind)).toEqual(['death', 'death'])
  })
})

describe('Maire', () => {
  it('le Maire tué la nuit doit désigner son successeur avant toute autre chose', () => {
    let s = setup([...BASE.slice(0, 6), ['Gaël', 'chasseur'], ['Hugo', 'villageois']])
    s = nightAndMorning(s)
    s = gameReducer(s, { type: 'ELECT_MAYOR', playerId: id(s, 'Gaël') })
    s = gameReducer(s, { type: 'VOTE', result: { kind: 'none' } })
    while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    s = gameReducer(s, { type: 'START_NIGHT' })
    s = playNight(s, { loup_garou: { victime: [id(s, 'Gaël')] } })
    expect(s.morning!.deaths).toEqual([id(s, 'Gaël')])
    s = gameReducer(s, { type: 'ACK_MORNING' })
    expect(s.alerts.map((a) => a.kind)).toEqual(['mayor_successor', 'hunter_shot'])
    expect(s.mayorId).toBeNull()
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Hugo') })
    expect(s.mayorId).toBe(id(s, 'Hugo'))
  })
})

describe('Infect Père des Loups', () => {
  it('infecte la victime : pas de mort, elle devient loup et garde son rôle', () => {
    let s = setup([['Ines', 'infect_pere'], ...BASE.slice(1)])
    s = playNight(s, {
      loup_garou: { victime: [id(s, 'Gaël')], infection: true },
    })
    expect(s.morning!.deaths).toEqual([])
    const gael = player(s, 'Gaël')
    expect(gael.alive).toBe(true)
    expect(gael.infected).toBe(true)
    expect(gael.roleId).toBe('voyante')
    expect(isWolf(gael)).toBe(true)
    expect(s.powers.infection).toBe(false)
  })

  it('ne propose plus l’infection une fois utilisée', () => {
    let s = setup([['Ines', 'infect_pere'], ...BASE.slice(1)])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Gaël')], infection: true } })
    s = quietDay(s)
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    while (currentStep(s)!.roleId !== 'loup_garou') s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    const pack = currentStep(s)!
    expect(stepActors(s, pack).map((p) => p.name)).toEqual(expect.arrayContaining(['Ines', 'Gaël']))
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: { victime: [id(s, 'Hugo')], infection: true } })
    while (s.phase === 'nuit') s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    expect(player(s, 'Hugo').alive).toBe(false)
    expect(player(s, 'Hugo').infected).toBe(false)
  })
})

describe('Renard', () => {
  const FOX: [string, RoleId][] = [
    ['Alice', 'loup_garou'],
    ['Bob', 'villageois'],
    ['Chloé', 'villageois'],
    ['David', 'renard'],
    ['Emma', 'villageois'],
    ['Farid', 'loup_garou'],
  ]

  it('dit OUI et garde son pouvoir si un loup est dans le groupe', () => {
    let s = setup(FOX)
    s = playNight(s, { renard: { cible: [id(s, 'Bob')] } })
    expect(s.powers.foxLost).toBe(false)
  })

  it('perd définitivement son pouvoir s’il n’y a aucun loup', () => {
    let s = setup(FOX)
    s = nightAndMorning(s, { renard: { cible: [id(s, 'Chloé')] } })
    expect(s.powers.foxLost).toBe(true)
    s = quietDay(s)
    const fox = s.night!.steps.find((st) => st.roleId === 'renard')!
    expect(stepStatus(s, fox)).toBe('power_lost')
  })

  it('recalcule les voisins en ignorant les morts', () => {
    let s = setup(FOX)
    // Bob meurt : les voisins vivants de Chloé deviennent Alice (loup) et David.
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Bob')] } })
    s = quietDay(s)
    s = playNight(s, { renard: { cible: [id(s, 'Chloé')] } })
    expect(s.powers.foxLost).toBe(false)
  })
})

describe('Autres règles', () => {
  it('Sorcière : potion de vie puis potion de mort, une seule fois chacune', () => {
    let s = setup(BASE)
    s = playNight(s, {
      loup_garou: { victime: [id(s, 'Chloé')] },
      sorciere: { vie: [id(s, 'Chloé')], mort: [id(s, 'Alice')] },
    })
    expect(s.morning!.deaths).toEqual([id(s, 'Alice')])
    expect(s.powers).toMatchObject({ witchLife: false, witchDeath: false })
  })

  it('l’Ancien survit à la première attaque des loups, pas à la seconde', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'ancien']])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Hugo')] } })
    expect(player(s, 'Hugo').alive).toBe(true)
    s = quietDay(s)
    s = playNight(s, { loup_garou: { victime: [id(s, 'Hugo')] } })
    expect(player(s, 'Hugo').alive).toBe(false)
  })

  it('l’Ange gagne s’il est éliminé au premier vote', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'ange']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'Hugo') } })
    expect(s.phase).toBe('fin')
    expect(s.winner).toBe('ange')
  })

  it('l’Idiot du village est gracié au vote', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'idiot']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'Hugo') } })
    expect(player(s, 'Hugo').alive).toBe(true)
    expect(s.powers.idiotRevealedIds).toContain(id(s, 'Hugo'))
  })

  it('le Bouc émissaire est éliminé en cas d’égalité', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'bouc_emissaire']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'tie' } })
    expect(player(s, 'Hugo').alive).toBe(false)
  })

  it('le Chevalier dévoré donne le tétanos au premier loup à sa gauche', () => {
    let s = setup([
      ['Alice', 'chevalier'],
      ['Bob', 'villageois'],
      ['Chloé', 'loup_garou'],
      ['David', 'loup_garou'],
      ['Emma', 'villageois'],
      ['Farid', 'villageois'],
    ])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Alice')] } })
    expect(s.powers.rustyTargetId).toBe(id(s, 'Chloé'))
    s = quietDay(s)
    s = playNight(s)
    expect(s.morning!.deaths).toEqual([id(s, 'Chloé')])
  })

  it('l’ours grogne si un voisin vivant est un loup', () => {
    let s = setup([
      ['Alice', 'villageois'],
      ['Bob', 'montreur_ours'],
      ['Chloé', 'loup_garou'],
      ['David', 'villageois'],
      ['Emma', 'villageois'],
    ])
    expect(bearGrowls(s).growls).toBe(true)
    s = nightAndMorning(s)
    expect(s.alerts.map((a) => a.kind)).toContain('bear')
    s = gameReducer(s, { type: 'EDIT_PLAYER', id: id(s, 'Chloé'), patch: { alive: false } })
    expect(bearGrowls(s).growls).toBe(false)
  })

  it('le Grand Méchant Loup perd sa seconde victime dès qu’un loup est mort', () => {
    let s = setup([...BASE.slice(0, 3), ['David', 'grand_mechant_loup'], ...BASE.slice(4)])
    s = nightAndMorning(s, {
      loup_garou: { victime: [id(s, 'Chloé')] },
      grand_mechant_loup: { victime: [id(s, 'Farid')] },
      sorciere: { mort: [id(s, 'Alice')] },
    })
    expect(['Chloé', 'Farid', 'Alice'].map((n) => player(s, n).alive)).toEqual([false, false, false])
    s = quietDay(s)
    const gml = s.night!.steps.find((st) => st.roleId === 'grand_mechant_loup')!
    expect(stepStatus(s, gml)).toBe('power_lost')
  })

  it('le village gagne quand le dernier loup est éliminé', () => {
    let s = setup(BASE)
    s = nightAndMorning(s, { sorciere: { mort: [id(s, 'Alice')] } })
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'David') } })
    while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    expect(s.winner).toBe('village')
  })

  it('mode progressif : les prénoms sont saisis pendant la nuit 1', () => {
    let s = createGame(
      { playerCount: 4, roleCounts: { loup_garou: 1, voyante: 1 }, nameMode: 'progressif', mayorEnabled: false, order: defaultOrder() },
      [],
      1,
    )
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    expect(stepStatus(s, currentStep(s)!)).toBe('identify')
    s = gameReducer(s, { type: 'IDENTIFY', names: { voyante: ['Léa'] } })
    s = gameReducer(s, { type: 'ADD_PLAYER', name: 'Kevin' })
    s = gameReducer(s, { type: 'REVEAL_ROLE', playerId: id(s, 'Kevin'), roleId: 'loup_garou' })
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: { cible: [id(s, 'Kevin')] } })
    expect(stepStatus(s, currentStep(s)!)).toBe('active') // la meute est déjà identifiée
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    expect(currentStep(s)!.kind).toBe('villageois')
    s = gameReducer(s, { type: 'IDENTIFY', names: { villageois: ['Max', 'Nina'] } })
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    expect(s.phase).toBe('matin')
    expect(s.players.map((p) => `${p.name}:${p.roleId}`)).toEqual([
      'Léa:voyante',
      'Kevin:loup_garou',
      'Max:villageois',
      'Nina:villageois',
    ])
  })
})
