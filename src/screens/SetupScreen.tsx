import { useEffect, useState } from 'react'
import { Banner, Button, Card, Hint, MainAction, SectionTitle, Stepper } from '../components/ui'
import { createGame } from '../engine/engine'
import { defaultOrder, getRole, ROLES, VILLAGER_ID } from '../engine/roles'
import { normalizeName } from '../engine/selectors'
import type { Camp, NameMode, RoleDef, RoleId } from '../engine/types'
import { useGame } from '../store/GameContext'
import { rememberNames, suggestNames } from '../store/knownNames'
import { OrderEditor } from './Sheets'

const DRAFT_KEY = 'werewolf-assistant:setup:v2'

interface Draft {
  page: 'roles' | 'options' | 'noms'
  playerCount: number
  roleCounts: Record<RoleId, number>
  nameMode: NameMode
  mayorEnabled: boolean
  names: string[]
  order: RoleId[]
  variantes: Record<RoleId, string>
}

const INITIAL: Draft = {
  page: 'roles',
  playerCount: 12,
  roleCounts: { loup_garou: 2, voyante: 1, sorciere: 1, chasseur: 1, cupidon: 1 },
  nameMode: 'progressif',
  mayorEnabled: true,
  names: [],
  order: defaultOrder(),
  variantes: {},
}

function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (!d) return INITIAL
    return { ...INITIAL, ...d, page: ['roles', 'options', 'noms'].includes(d.page) ? d.page : 'options' }
  } catch {
    return INITIAL
  }
}

const CAMP_STYLES: Record<Camp, { label: string; className: string }> = {
  village: { label: 'Village', className: 'text-emerald-300' },
  loups: { label: 'Loups', className: 'text-red-300' },
  solo: { label: 'Solitaire', className: 'text-violet-300' },
  ambigu: { label: 'Au choix', className: 'text-amber-300' },
}

function allowedValues(r: RoleDef) {
  return [0, ...(r.quantites.permises ?? Array.from({ length: r.quantites.max }, (_, i) => i + 1))]
}

function RoleCard({ role, count, onChange }: { role: RoleDef; count: number; onChange: (n: number) => void }) {
  const values = allowedValues(role)
  const next = values.find((v) => v > count)
  const prev = [...values].reverse().find((v) => v < count)
  const camp = CAMP_STYLES[role.camp]
  return (
    <div className={`flex flex-col rounded-2xl border-2 p-3 ${count ? 'border-moon bg-night-800' : 'border-transparent bg-night-900'}`}>
      <button type="button" className="flex-1 text-left" onClick={() => next !== undefined && onChange(next)}>
        <div className="flex items-start justify-between">
          <span className="text-4xl" aria-hidden>
            {role.emoji}
          </span>
          {count > 0 && <span className="rounded-full bg-moon px-2.5 text-lg font-bold text-night-950">{count}</span>}
        </div>
        <div className="mt-1 leading-tight font-semibold">{role.nom}</div>
        <div className={`text-xs ${camp.className}`}>{camp.label}</div>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Button variant="ghost" className="px-0 text-2xl" disabled={prev === undefined} onClick={() => prev !== undefined && onChange(prev)} aria-label={`Retirer ${role.nom}`}>
          −
        </Button>
        <Button variant="ghost" className="px-0 text-2xl" disabled={next === undefined} onClick={() => next !== undefined && onChange(next)} aria-label={`Ajouter ${role.nom}`}>
          +
        </Button>
      </div>
    </div>
  )
}

function PlayerNames({ draft, update, seated }: { draft: Draft; update: (d: Partial<Draft>) => void; seated: boolean }) {
  const [value, setValue] = useState('')
  const taken = new Set(draft.names.map(normalizeName))
  const duplicate = taken.has(normalizeName(value))
  const full = draft.names.length >= draft.playerCount
  const add = (name = value) => {
    const n = name.trim()
    if (!n || taken.has(normalizeName(n)) || full) return
    update({ names: [...draft.names, n] })
    setValue('')
  }
  const move = (i: number, dir: -1 | 1) => {
    const names = [...draft.names]
    ;[names[i], names[i + dir]] = [names[i + dir], names[i]]
    update({ names })
  }
  return (
    <div className="space-y-3">
      <Hint>
        {seated
          ? 'Saisis les prénoms dans l’ordre où les joueurs sont assis, en tournant dans le sens des aiguilles d’une montre. Le dernier est voisin du premier.'
          : 'Saisis les prénoms de tous les joueurs, dans n’importe quel ordre. Pendant la première nuit, tu n’auras plus qu’à toucher le prénom de chaque rôle.'}
      </Hint>
      <ol className="space-y-2">
        {draft.names.map((name, i) => (
          <li key={name} className="flex items-center gap-1 rounded-2xl bg-night-800 py-1 pr-1 pl-4">
            <span className="flex-1 text-lg">
              <span className="text-night-400">{i + 1}.</span> {name}
            </span>
            {seated && (
              <>
                <Button variant="ghost" className="w-12 px-0" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">
                  ↑
                </Button>
                <Button variant="ghost" className="w-12 px-0" disabled={i === draft.names.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
                  ↓
                </Button>
              </>
            )}
            <Button variant="ghost" className="w-12 px-0" onClick={() => update({ names: draft.names.filter((_, j) => j !== i) })} aria-label="Supprimer">
              ✕
            </Button>
          </li>
        ))}
      </ol>
      {!full && (
        <>
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={`Joueur ${draft.names.length + 1}`}
              autoCapitalize="words"
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-2xl bg-night-800 px-4 text-xl outline-none focus:ring-2 focus:ring-moon"
            />
            <Button variant="primary" disabled={!value.trim() || duplicate} onClick={() => add()}>
              Ajouter
            </Button>
          </div>
          {duplicate && <Banner tone="danger">Ce prénom est déjà saisi.</Banner>}
          <div className="flex flex-wrap gap-2">
            {suggestNames(value, taken).map((n) => (
              <Button key={n} variant="ghost" className="min-h-12 text-base" onClick={() => add(n)}>
                {n}
              </Button>
            ))}
          </div>
        </>
      )}
      <p className="text-center text-night-400">
        {draft.names.length} / {draft.playerCount} joueurs {seated ? 'placés' : 'saisis'}
      </p>
    </div>
  )
}

export function SetupScreen() {
  const { startGame } = useGame()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const update = (d: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...d }))

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Brouillon non sauvegardé : sans conséquence.
    }
  }, [draft])

  const assigned = Object.entries(draft.roleCounts).reduce((sum, [id, n]) => sum + (id === VILLAGER_ID ? 0 : n), 0)
  const villagers = draft.playerCount - assigned
  const selected = ROLES.filter((r) => (draft.roleCounts[r.id] ?? 0) > 0)
  const hasWolf = selected.some((r) => r.estLoup)
  const circleRoles = selected.filter((r) => r.requiertCercle)
  const nameMode: NameMode = circleRoles.length ? 'cercle' : draft.nameMode

  const rolesError =
    villagers < 0
      ? `Trop de rôles : ${assigned} rôles pour ${draft.playerCount} joueurs.`
      : !hasWolf
        ? 'Ajoute au moins un Loup-Garou.'
        : null

  const launch = () => {
    const names = nameMode === 'progressif' ? [] : draft.names
    const game = createGame(
      {
        playerCount: draft.playerCount,
        roleCounts: Object.fromEntries(Object.entries(draft.roleCounts).filter(([, n]) => n > 0)),
        nameMode,
        mayorEnabled: draft.mayorEnabled,
        order: draft.order,
        variantes: draft.variantes,
      },
      names,
    )
    rememberNames(names)
    localStorage.removeItem(DRAFT_KEY)
    startGame(game)
  }

  if (draft.page === 'roles') {
    return (
      <div className="space-y-5 animate-rise">
        <div className="pt-4 text-center">
          <div className="text-6xl" aria-hidden>
            🐺
          </div>
          <h1 className="mt-2 font-tale text-4xl font-bold text-moon">Nouvelle partie</h1>
        </div>
        <Card className="flex items-center justify-between gap-3">
          <span className="text-xl font-semibold">Joueurs</span>
          <Stepper value={draft.playerCount} min={4} max={40} onChange={(playerCount) => update({ playerCount })} />
        </Card>
        <SectionTitle>Rôles en jeu</SectionTitle>
        <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
          {ROLES.filter((r) => r.id !== VILLAGER_ID).map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              count={draft.roleCounts[r.id] ?? 0}
              onChange={(n) => update({ roleCounts: { ...draft.roleCounts, [r.id]: n } })}
            />
          ))}
        </div>
        <div className="sticky bottom-0 -mx-4 space-y-2 bg-night-950/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="flex justify-between text-lg">
            <span>
              Rôles attribués : <b className={villagers < 0 ? 'text-blood' : 'text-moon'}>{assigned}</b> / {draft.playerCount}
            </span>
            <span className="text-night-400">+ {Math.max(0, villagers)} 🧑‍🌾</span>
          </div>
          {rolesError && <Banner tone="danger">⚠️ {rolesError}</Banner>}
          <Button variant="primary" className="min-h-16 w-full text-xl" disabled={!!rolesError} onClick={() => update({ page: 'options' })}>
            Continuer →
          </Button>
        </div>
      </div>
    )
  }

  if (draft.page === 'options') {
    const inGame = new Set(selected.map((r) => r.id))
    const hasPackStep = draft.order.find((id) => getRole(id).meute)
    if (hasPackStep && hasWolf) inGame.add(hasPackStep)
    const nextPage = nameMode === 'progressif' ? null : 'noms'
    return (
      <div className="space-y-5 animate-rise">
        <Button variant="ghost" onClick={() => update({ page: 'roles' })}>
          ← Rôles
        </Button>
        <h1 className="font-tale text-3xl font-bold text-moon">Options de la partie</h1>

        <SectionTitle>Maire</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={draft.mayorEnabled ? 'primary' : 'ghost'} onClick={() => update({ mayorEnabled: true })}>
            👑 Avec Maire
          </Button>
          <Button variant={!draft.mayorEnabled ? 'primary' : 'ghost'} onClick={() => update({ mayorEnabled: false })}>
            Sans Maire
          </Button>
        </div>

        {selected
          .filter((r) => r.variantes?.length)
          .map((r) => {
            const current = draft.variantes[r.id] ?? r.variantes![0].id
            return (
              <div key={r.id} className="space-y-2">
                <SectionTitle>
                  {r.emoji} Mode {r.nom}
                </SectionTitle>
                <div className="grid gap-2">
                  {r.variantes!.map((v) => (
                    <Button
                      key={v.id}
                      variant={current === v.id ? 'primary' : 'ghost'}
                      className="text-left"
                      onClick={() => update({ variantes: { ...draft.variantes, [r.id]: v.id } })}
                    >
                      {v.nom}
                      <span className="block text-sm font-normal">{v.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}

        <SectionTitle>Saisie des prénoms</SectionTitle>
        {circleRoles.length > 0 ? (
          <Banner tone="warning">
            🪑 <b>Placement en cercle obligatoire</b> : {circleRoles.map((r) => r.nom).join(' et ')} dépend(ent) des voisins de
            chaque joueur.
          </Banner>
        ) : (
          <div className="grid gap-2">
            <Button variant={nameMode === 'progressif' ? 'primary' : 'ghost'} className="text-left" onClick={() => update({ nameMode: 'progressif' })}>
              ✍️ Progressif (recommandé)
              <span className="block text-sm font-normal">Tu saisis les prénoms pendant la première nuit, rôle par rôle.</span>
            </Button>
            <Button variant={nameMode === 'liste' ? 'primary' : 'ghost'} className="text-left" onClick={() => update({ nameMode: 'liste' })}>
              📋 Liste des joueurs
              <span className="block text-sm font-normal">
                Tu saisis tous les prénoms maintenant. La nuit 1, tu n’as plus qu’à les sélectionner pour attribuer les rôles.
              </span>
            </Button>
            <Button variant={nameMode === 'cercle' ? 'primary' : 'ghost'} className="text-left" onClick={() => update({ nameMode: 'cercle' })}>
              🪑 Placement en cercle
              <span className="block text-sm font-normal">Comme la liste, mais dans l’ordre des places (utile pour les voisins).</span>
            </Button>
            {selected.some((r) => r.effets.includes('tetanos')) && nameMode !== 'cercle' && (
              <Hint>Avec le Chevalier, le cercle permet à l’app de trouver seule le loup à sa gauche.</Hint>
            )}
          </div>
        )}

        <SectionTitle>Ordre d’appel la nuit</SectionTitle>
        <Hint>L’ordre officiel est déjà réglé. Tu peux le modifier si tu as tes habitudes.</Hint>
        <OrderEditor order={draft.order} only={inGame} onChange={(order) => update({ order })} />
        <Button variant="ghost" className="w-full" onClick={() => update({ order: defaultOrder() })}>
          Rétablir l’ordre officiel
        </Button>

        {nextPage ? (
          <MainAction onClick={() => update({ page: nextPage, nameMode })}>
            {nameMode === 'cercle' ? 'Placer les joueurs →' : 'Saisir les joueurs →'}
          </MainAction>
        ) : (
          <MainAction onClick={launch}>Commencer la partie 🌙</MainAction>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-rise">
      <Button variant="ghost" onClick={() => update({ page: 'options' })}>
        ← Options
      </Button>
      <h1 className="font-tale text-3xl font-bold text-moon">{nameMode === 'cercle' ? 'Placement en cercle' : 'Liste des joueurs'}</h1>
      <PlayerNames draft={draft} update={update} seated={nameMode === 'cercle'} />
      <MainAction disabled={draft.names.length !== draft.playerCount} onClick={launch}>
        Commencer la partie 🌙
      </MainAction>
    </div>
  )
}
