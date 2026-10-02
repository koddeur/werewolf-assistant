import { useState } from 'react'
import { getRole, VILLAGER_ID } from '../engine/roles'
import { normalizeName, playerByName, remainingSlots, unassignedPlayers } from '../engine/selectors'
import type { RoleId } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'
import { suggestNames } from '../store/knownNames'
import { PlayerPicker } from './PlayerPicker'
import { Banner, Button, SectionTitle } from './ui'

/**
 * Saisie des prénoms des joueurs qui se réveillent.
 * Progressif : champs texte avec autocomplétion. Liste ou cercle : choix parmi les joueurs déjà saisis.
 */
export function IdentifyPanel({ roleIds }: { roleIds: RoleId[] }) {
  const { game, dispatch } = useCurrentGame()
  const remaining = remainingSlots(game)
  const unassigned = unassignedPlayers(game)
  // Prénoms déjà saisis avant la partie : on choisit parmi eux au lieu de taper.
  const circle = game.config.nameMode !== 'progressif'

  const [names, setNames] = useState<Record<RoleId, string[]>>(() => {
    const init: Record<RoleId, string[]> = {}
    let pool = unassigned.map((p) => p.name)
    for (const id of roleIds) {
      const n = remaining[id] ?? 0
      // Les joueurs déjà nommés mais sans rôle sont forcément les Simples Villageois restants.
      const prefill = id === VILLAGER_ID && roleIds.length === 1 ? pool.slice(0, n) : []
      pool = pool.filter((x) => !prefill.includes(x))
      init[id] = circle ? prefill : [...prefill, ...Array(n - prefill.length).fill('')]
    }
    return init
  })
  const [focus, setFocus] = useState<{ role: RoleId; i: number } | null>(null)

  const all = Object.values(names).flat().filter((n) => n.trim())
  const used = new Set(all.map(normalizeName))

  const error = (() => {
    if (all.length !== roleIds.reduce((sum, id) => sum + (remaining[id] ?? 0), 0)) return null
    if (used.size !== all.length) return 'Un même prénom est saisi deux fois.'
    for (const [roleId, list] of Object.entries(names)) {
      for (const name of list) {
        const p = playerByName(game, name)
        if (p && p.roleId && p.roleId !== roleId) return `${p.name} est déjà ${getRole(p.roleId).nom}.`
      }
    }
    const newcomers = all.filter((n) => !playerByName(game, n)).length
    if (game.players.length + newcomers > game.config.playerCount) {
      return `Trop de joueurs : la partie en compte ${game.config.playerCount}.`
    }
    return null
  })()

  const complete = roleIds.every((id) => names[id].filter((n) => n.trim()).length === (remaining[id] ?? 0))

  const setName = (role: RoleId, i: number, value: string) =>
    setNames((prev) => ({ ...prev, [role]: prev[role].map((v, j) => (j === i ? value : v)) }))

  /** Joueurs déjà nommés sans rôle, puis prénoms des parties précédentes. */
  const suggestions = (typed: string): string[] => {
    const t = normalizeName(typed)
    const fromGame = unassigned
      .filter((p) => !used.has(normalizeName(p.name)) && normalizeName(p.name).startsWith(t))
      .map((p) => p.name)
    const taken = new Set([...game.players.map((p) => normalizeName(p.name)), ...used])
    return [...fromGame, ...suggestNames(typed, taken)].filter((n) => normalizeName(n) !== t).slice(0, 8)
  }

  return (
    <div className="space-y-4">
      {roleIds.map((roleId) => {
        const role = getRole(roleId)
        const n = remaining[roleId] ?? 0
        return (
          <div key={roleId}>
            <SectionTitle>
              {role.emoji} {n > 1 ? `Qui sont les ${n} ${role.nom_pluriel ?? role.nom} ?` : `Qui est ${role.nom} ?`}
            </SectionTitle>
            {circle ? (
              <PlayerPicker
                count={n}
                value={names[roleId].map((name) => playerByName(game, name)!.id)}
                onChange={(ids) =>
                  setNames((prev) => ({ ...prev, [roleId]: ids.map((id) => game.players.find((p) => p.id === id)!.name) }))
                }
                options={unassigned
                  .filter((p) => !used.has(normalizeName(p.name)) || names[roleId].includes(p.name))
                  .map((player) => ({ player }))}
              />
            ) : (
              <div className="space-y-2">
                {names[roleId].map((value, i) => {
                  const focused = focus?.role === roleId && focus.i === i
                  const sugg = focused ? suggestions(value) : []
                  return (
                    <div key={i}>
                      <input
                        value={value}
                        onChange={(e) => setName(roleId, i, e.target.value)}
                        onFocus={() => setFocus({ role: roleId, i })}
                        placeholder={n > 1 ? `Prénom ${i + 1}` : 'Prénom'}
                        autoCapitalize="words"
                        autoComplete="off"
                        className="min-h-14 w-full rounded-2xl bg-night-800 px-4 text-xl outline-none focus:ring-2 focus:ring-moon"
                      />
                      {sugg.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sugg.map((name) => (
                            <Button key={name} variant="ghost" className="min-h-12 text-base" onClick={() => setName(roleId, i, name)}>
                              {name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {error && <Banner tone="danger">⚠️ {error}</Banner>}
      <Button
        variant="primary"
        className="w-full"
        disabled={!complete || !!error}
        onClick={() => dispatch({ type: 'IDENTIFY', names: Object.fromEntries(roleIds.map((id) => [id, names[id].map((n) => n.trim())])) })}
      >
        Valider les prénoms
      </Button>
    </div>
  )
}
