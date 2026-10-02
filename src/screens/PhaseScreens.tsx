import { useState } from 'react'
import { PlayerPicker } from '../components/PlayerPicker'
import { roleLabel } from '../components/playerLabels'
import { Banner, Button, Card, Hint, MainAction, Phrase, SectionTitle } from '../components/ui'
import { narrate } from '../engine/narration'
import { hasEffect, getRole } from '../engine/roles'
import { alivePlayers, displayName, isWolf, playerById, roleName } from '../engine/selectors'
import { WINNER_LABELS } from '../engine/victory'
import type { VoteResult } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'

function PhaseHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="pt-4 text-center">
      <div className="text-7xl" aria-hidden>
        {emoji}
      </div>
      <h1 className="mt-2 font-tale text-4xl font-bold text-moon">{title}</h1>
    </div>
  )
}

export function NightIntro() {
  const { game, dispatch } = useCurrentGame()
  const n = game.night!.number
  return (
    <div className="space-y-5 animate-rise">
      <PhaseHeader emoji="🌙" title={`Nuit ${n}`} />
      <Phrase>{narrate('tombee_nuit', game.seed, n)}</Phrase>
      {n === 1 && (
        <Hint>
          Cette nuit, chaque rôle se réveille une première fois : l’app te demandera les prénoms au fur et à mesure.
        </Hint>
      )}
      <Card>
        <SectionTitle>Programme de la nuit</SectionTitle>
        <ol className="list-inside list-decimal space-y-1 text-lg">
          {game.night!.steps.map((st) => {
            const role = getRole(st.roleId)
            const c = st.kind === 'amoureux' || st.kind === 'charmes' ? role.compagnon : undefined
            return <li key={st.key}>{st.kind === 'villageois' ? '🧑‍🌾 Joueurs restants' : `${(c ?? role).emoji} ${(c ?? role).nom}`}</li>
          })}
        </ol>
      </Card>
      <MainAction onClick={() => dispatch({ type: 'START_NIGHT_INTRO' })}>Tout le monde ferme les yeux 🌙</MainAction>
    </div>
  )
}

export function MorningScreen() {
  const { game, dispatch } = useCurrentGame()
  const deaths = game.morning?.deaths ?? []
  return (
    <div className="space-y-5 animate-rise">
      <PhaseHeader emoji="🌅" title="Le village se réveille" />
      <Phrase>{narrate('lever_jour', game.seed, game.turn)}</Phrase>
      {deaths.length === 0 ? (
        <>
          <Banner tone="success">
            <b>Personne n’est mort cette nuit.</b>
          </Banner>
          <Phrase>{narrate('personne_mort', game.seed, game.turn)}</Phrase>
        </>
      ) : (
        deaths.map((id) => {
          const p = playerById(game, id)!
          return (
            <div key={id} className="space-y-2">
              <Banner tone="danger">
                💀 Ce matin, <b>{p.name}</b> est mort(e). Sa carte : <b>{roleName(p.roleId)}</b>
              </Banner>
              <Phrase>{narrate('annonce_mort', game.seed, `${game.turn}:${id}`, { nom: p.name })}</Phrase>
            </div>
          )
        })
      )}
      <MainAction onClick={() => dispatch({ type: 'ACK_MORNING' })}>Annonce faite ✓</MainAction>
    </div>
  )
}

function MayorElection() {
  const { game, dispatch } = useCurrentGame()
  const [value, setValue] = useState<string[]>([])
  return (
    <div className="space-y-5 animate-rise">
      <PhaseHeader emoji="👑" title="Élection du Maire" />
      <Phrase>
        Avant toute chose, le village doit élire son Maire. Sa voix comptera double lors des votes, et s’il meurt, il choisira son
        successeur.
      </Phrase>
      <SectionTitle>Maire élu</SectionTitle>
      <PlayerPicker options={alivePlayers(game).map((player) => ({ player }))} count={1} value={value} onChange={setValue} />
      <Button variant="ghost" className="w-full" onClick={() => dispatch({ type: 'ELECT_MAYOR', playerId: null })}>
        Pas de Maire pour cette partie
      </Button>
      <MainAction disabled={!value.length} onClick={() => dispatch({ type: 'ELECT_MAYOR', playerId: value[0] })}>
        Valider le Maire ✓
      </MainAction>
    </div>
  )
}

function VoteScreen() {
  const { game, dispatch } = useCurrentGame()
  const [choice, setChoice] = useState<VoteResult | null>(null)
  const alive = alivePlayers(game)
  const raven = playerById(game, game.powers.ravenTargetId)
  const goat = alive.find((p) => hasEffect(p.roleId, 'elimine_si_egalite'))
  const idiot = alive.find((p) => hasEffect(p.roleId, 'gracie_au_vote') && !game.powers.idiotRevealedIds.includes(p.id))
  const revealedIdiots = game.powers.idiotRevealedIds.map((id) => playerById(game, id)!).filter((p) => p.alive)
  const angel = alive.find((p) => hasEffect(p.roleId, 'gagne_si_elimine_premier_vote'))

  const reminders: string[] = []
  if (game.mayorId) reminders.push(`👑 La voix du Maire (${displayName(game, game.mayorId)}) compte double.`)
  if (raven?.alive) reminders.push(`🐦‍⬛ Le Corbeau a désigné ${raven.name} : +2 voix contre lui.`)
  if (revealedIdiots.length) reminders.push(`🤪 ${revealedIdiots.map((p) => p.name).join(', ')} ne vote plus.`)
  if (goat && !game.powers.villagePowersLost) reminders.push(`🐐 En cas d’égalité, le Bouc émissaire (${goat.name}) est éliminé.`)
  if (idiot && !game.powers.villagePowersLost) reminders.push(`🤪 Si ${idiot.name} est désigné, il sera gracié (Idiot du village).`)
  if (angel && game.powers.votesHeld === 0) reminders.push(`😇 Si ${angel.name} est éliminé à ce premier vote, l’Ange gagne seul !`)

  const label =
    choice?.kind === 'player'
      ? `Éliminer ${displayName(game, choice.id)}`
      : choice?.kind === 'tie'
        ? 'Valider l’égalité'
        : choice?.kind === 'none'
          ? 'Personne n’est éliminé'
          : 'Choisis le résultat du vote'

  return (
    <div className="space-y-5 animate-rise">
      <PhaseHeader emoji="⚖️" title={`Jour ${game.turn} · Le vote`} />
      <Phrase>{narrate('vote', game.seed, game.turn)}</Phrase>
      {reminders.length > 0 && (
        <Card>
          <SectionTitle>Rappels</SectionTitle>
          <ul className="space-y-2 text-lg leading-snug">
            {reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}
      <SectionTitle>Joueur désigné par le village</SectionTitle>
      <PlayerPicker
        options={alive.map((player) => ({ player }))}
        count={1}
        value={choice?.kind === 'player' ? [choice.id] : []}
        onChange={(ids) => setChoice(ids.length ? { kind: 'player', id: ids[0] } : null)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant={choice?.kind === 'none' ? 'primary' : 'ghost'} onClick={() => setChoice({ kind: 'none' })}>
          Personne
        </Button>
        <Button variant={choice?.kind === 'tie' ? 'primary' : 'ghost'} onClick={() => setChoice({ kind: 'tie' })}>
          Égalité
        </Button>
      </div>
      <MainAction disabled={!choice} onClick={() => choice && dispatch({ type: 'VOTE', result: choice })}>
        {label}
      </MainAction>
    </div>
  )
}

function Dusk() {
  const { game, dispatch } = useCurrentGame()
  return (
    <div className="space-y-5 animate-rise">
      <PhaseHeader emoji="🌇" title="Le soir tombe" />
      <Phrase>{narrate('tombee_nuit', game.seed, `soir-${game.turn}`)}</Phrase>
      <Hint>Il reste {alivePlayers(game).length} joueurs en vie.</Hint>
      <MainAction onClick={() => dispatch({ type: 'START_NIGHT' })}>Passer à la nuit {game.turn + 1} 🌙</MainAction>
    </div>
  )
}

export function DayScreen() {
  const { game } = useCurrentGame()
  const day = game.day!
  if (game.turn === 1 && game.config.mayorEnabled && !game.mayorId && !day.mayorDone) return <MayorElection />
  if (!day.voteDone) return <VoteScreen />
  return <Dusk />
}

export function EndScreen({ onJournal }: { onJournal: () => void }) {
  const { game, quit } = useCurrentGame()
  const w = WINNER_LABELS[game.winner ?? 'personne']
  const sorted = [...game.players].sort((a, b) => Number(b.alive) - Number(a.alive))
  return (
    <div className="space-y-5 animate-rise">
      <div className="rounded-3xl border-2 border-moon bg-moon/10 p-6 text-center">
        <div className="text-7xl" aria-hidden>
          {w.emoji}
        </div>
        <h1 className="mt-3 font-tale text-4xl leading-tight font-bold text-moon">{w.title}</h1>
      </div>
      <Phrase>{narrate('victoire', game.seed, 'fin')}</Phrase>
      <Card>
        <SectionTitle>Les rôles de chacun</SectionTitle>
        <ul className="divide-y divide-night-700">
          {sorted.map((p) => (
            <li key={p.id} className={`flex items-center justify-between gap-3 py-2 ${p.alive ? '' : 'opacity-60'}`}>
              <span className="text-lg font-semibold">
                {p.alive ? '' : '💀 '}
                {p.name}
                {game.lovers?.includes(p.id) && ' ❤️'}
              </span>
              <span className={`text-right text-sm ${isWolf(p) ? 'text-red-300' : 'text-night-400'}`}>{roleLabel(p)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Button variant="secondary" className="w-full" onClick={onJournal}>
        📜 Voir le journal de la partie
      </Button>
      <MainAction onClick={quit}>Nouvelle partie</MainAction>
    </div>
  )
}
