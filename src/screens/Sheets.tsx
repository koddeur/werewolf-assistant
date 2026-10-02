import { useState } from 'react'
import { roleLabel } from '../components/playerLabels'
import { Banner, Button, Card, SectionTitle, Sheet } from '../components/ui'
import { getRole, ROLES } from '../engine/roles'
import { playerBadges, remainingSlots, roleName } from '../engine/selectors'
import type { Player, PlayerPatch, RoleId } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Button variant={value ? 'primary' : 'ghost'} className="w-full text-left" onClick={() => onChange(!value)}>
      {value ? '✓ ' : ''}
      {label}
    </Button>
  )
}

function PlayerEditor({ player, onClose }: { player: Player; onClose: () => void }) {
  const { game, dispatch } = useCurrentGame()
  const [name, setName] = useState(player.name)
  const edit = (patch: PlayerPatch) =>
    dispatch({ type: 'EDIT_PLAYER', id: player.id, patch })
  return (
    <Sheet title={`Corriger : ${player.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Banner tone="warning">
          Corrections manuelles : elles ne déclenchent aucune conséquence (pas de chagrin, pas de tir…). Pour une erreur de saisie
          récente, préfère « ↶ Annuler ».
        </Banner>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-night-800 px-4 text-xl outline-none focus:ring-2 focus:ring-moon"
          />
          <Button variant="secondary" disabled={!name.trim() || name === player.name} onClick={() => edit({ name })}>
            Renommer
          </Button>
        </div>
        <label className="block">
          <SectionTitle>Rôle (carte)</SectionTitle>
          <select
            value={player.roleId ?? ''}
            onChange={(e) => edit({ roleId: (e.target.value || null) as RoleId | null })}
            className="min-h-14 w-full rounded-2xl bg-night-800 px-4 text-xl"
          >
            <option value="">❔ Inconnu</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji} {r.nom}
              </option>
            ))}
          </select>
        </label>
        <SectionTitle>Statuts</SectionTitle>
        <div className="grid gap-2">
          <Toggle label="Vivant" value={player.alive} onChange={(alive) => edit({ alive })} />
          <Toggle label="👑 Maire" value={game.mayorId === player.id} onChange={(mayor) => edit({ mayor })} />
          <Toggle label="🐺 Infecté" value={player.infected} onChange={(infected) => edit({ infected })} />
          <Toggle label="🐺 Devenu loup (Enfant sauvage / Chien-loup)" value={player.turnedWolf} onChange={(turnedWolf) => edit({ turnedWolf })} />
          <Toggle label="🎶 Charmé" value={player.charmed} onChange={(charmed) => edit({ charmed })} />
        </div>
      </div>
    </Sheet>
  )
}

export function PlayersSheet({ onClose }: { onClose: () => void }) {
  const { game } = useCurrentGame()
  const [editing, setEditing] = useState<string | null>(null)
  const sorted = [...game.players].sort((a, b) => Number(b.alive) - Number(a.alive) || (a.seat ?? 0) - (b.seat ?? 0))
  const remaining = Object.entries(remainingSlots(game))
  const missing = game.config.playerCount - game.players.length
  const edited = game.players.find((p) => p.id === editing)

  return (
    <Sheet title={`Joueurs (${game.players.filter((p) => p.alive).length} vivants)`} onClose={onClose}>
      <div className="space-y-2">
        {sorted.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setEditing(p.id)}
            className={`w-full rounded-2xl bg-night-800 px-4 py-3 text-left active:bg-night-700 ${p.alive ? '' : 'opacity-50'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-xl font-semibold ${p.alive ? '' : 'line-through'}`}>
                {p.alive ? '' : '💀 '}
                {p.name}
              </span>
              <span className="text-sm text-night-400">{roleLabel(p)}</span>
            </div>
            {playerBadges(game, p).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {playerBadges(game, p).map((b) => (
                  <span key={b} className="rounded-full bg-night-700 px-2 py-0.5 text-sm">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
        {(missing > 0 || remaining.length > 0) && (
          <Card className="mt-4">
            <SectionTitle>Pas encore identifiés</SectionTitle>
            {missing > 0 && <p>{missing} joueur(s) sans prénom.</p>}
            <p className="text-night-400">
              Cartes restantes : {remaining.map(([id, n]) => `${n} × ${getRole(id).nom}`).join(', ')}
            </p>
          </Card>
        )}
      </div>
      {edited && <PlayerEditor player={edited} onClose={() => setEditing(null)} />}
    </Sheet>
  )
}

export function JournalSheet({ onClose }: { onClose: () => void }) {
  const { game } = useCurrentGame()
  const groups: { label: string; entries: string[] }[] = []
  for (const entry of game.log) {
    const label = entry.phase === 'nuit' ? `🌙 Nuit ${entry.turn}` : entry.phase === 'fin' ? '🏁 Fin' : `☀️ Jour ${entry.turn}`
    const last = groups[groups.length - 1]
    if (last?.label === label) last.entries.push(entry.text)
    else groups.push({ label, entries: [entry.text] })
  }
  return (
    <Sheet title="Journal de la partie" onClose={onClose}>
      <div className="space-y-4">
        {groups.map((g, i) => (
          <Card key={i}>
            <SectionTitle>{g.label}</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-lg leading-snug">
              {g.entries.map((t, j) => (
                <li key={j}>{t}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Sheet>
  )
}

/** Réordonnancement de l'ordre d'appel (boutons haut/bas, utilisables d'une main). */
export function OrderEditor({ order, onChange, only }: { order: RoleId[]; onChange: (o: RoleId[]) => void; only?: Set<RoleId> }) {
  const visible = order.filter((id) => !only || only.has(id))
  const move = (id: RoleId, dir: -1 | 1) => {
    const i = visible.indexOf(id)
    const other = visible[i + dir]
    if (!other) return
    const next = [...order]
    const a = next.indexOf(id)
    const b = next.indexOf(other)
    ;[next[a], next[b]] = [next[b], next[a]]
    onChange(next)
  }
  return (
    <ol className="space-y-2">
      {visible.map((id, i) => {
        const r = getRole(id)
        return (
          <li key={id} className="flex items-center gap-2 rounded-2xl bg-night-800 py-1 pr-1 pl-4">
            <span className="flex-1 text-lg">
              {i + 1}. {r.emoji} {r.nom}
              <span className="block text-xs text-night-400">{FREQ_LABELS[r.frequence]}</span>
            </span>
            <Button variant="ghost" className="w-14 px-0" disabled={i === 0} onClick={() => move(id, -1)} aria-label="Monter">
              ↑
            </Button>
            <Button variant="ghost" className="w-14 px-0" disabled={i === visible.length - 1} onClick={() => move(id, 1)} aria-label="Descendre">
              ↓
            </Button>
          </li>
        )
      })}
    </ol>
  )
}

const NAME_MODE_LABELS = { progressif: 'progressifs', liste: 'saisis avant la partie', cercle: 'en cercle' }

const FREQ_LABELS = {
  premiere_nuit: 'Première nuit uniquement',
  chaque_nuit: 'Chaque nuit',
  une_nuit_sur_deux: 'Une nuit sur deux (nuits paires)',
  jamais_la_nuit: 'Identifié la première nuit',
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { game, dispatch, quit } = useCurrentGame()
  const [confirm, setConfirm] = useState(false)
  const inGame = new Set(
    game.config.order.filter((id) => getRole(id).meute || (game.config.roleCounts[id] ?? 0) > 0),
  )
  return (
    <Sheet title="Paramètres" onClose={onClose}>
      <div className="space-y-4">
        <SectionTitle>Ordre d’appel (nuits suivantes)</SectionTitle>
        <OrderEditor order={game.config.order} only={inGame} onChange={(order) => dispatch({ type: 'SET_ORDER', order })} />
        <SectionTitle>Partie</SectionTitle>
        <Card>
          <p className="text-night-400">
            {game.config.playerCount} joueurs · prénoms {NAME_MODE_LABELS[game.config.nameMode]} ·{' '}
            Maire {game.config.mayorEnabled ? 'activé' : 'désactivé'}
          </p>
          <p className="mt-2 text-night-400">
            Rôles :{' '}
            {Object.entries(game.config.roleCounts)
              .filter(([, n]) => n > 0)
              .map(([id, n]) => `${n > 1 ? `${n} × ` : ''}${roleName(id)}`)
              .join(', ')}
          </p>
        </Card>
        {confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={quit}>
              Oui, abandonner
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Non
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="w-full text-red-300" onClick={() => setConfirm(true)}>
            Abandonner et créer une nouvelle partie
          </Button>
        )}
      </div>
    </Sheet>
  )
}
