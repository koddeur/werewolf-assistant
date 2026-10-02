import { useState, type ReactNode } from 'react'
import { PlayerPicker } from '../components/PlayerPicker'
import { roleLabel } from '../components/playerLabels'
import { pickerOptions } from '../components/pickerOptions'
import { IdentifyPanel } from '../components/IdentifyPanel'
import { RevealPanel } from '../components/RevealPanel'
import { Banner, Button, Card, Hint, MainAction, Phrase, SectionTitle } from '../components/ui'
import { getRole } from '../engine/roles'
import {
  availableActions,
  foxGroup,
  isWolf,
  nightVictims,
  playerById,
  rolesToIdentify,
  stepActors,
  stepStatus,
} from '../engine/selectors'
import type { ActionDef, GameState, NightStep, SelectionValue } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'

type Selections = Record<string, SelectionValue>

function BigResult({ tone = 'moon', children }: { tone?: 'moon' | 'yes' | 'no'; children: ReactNode }) {
  const tones = {
    moon: 'border-moon bg-moon/15',
    yes: 'border-forest bg-forest/20',
    no: 'border-blood bg-blood/20',
  }
  return (
    <div className={`animate-rise rounded-3xl border-2 p-5 text-center ${tones[tone]}`}>
      <div className="mb-1 text-xs font-semibold tracking-widest text-night-400 uppercase">Résultat à montrer</div>
      <div className="text-3xl leading-tight font-bold">{children}</div>
    </div>
  )
}

function neededCount(s: GameState, action: ActionDef, actorIds: string[]) {
  const valid = pickerOptions(s, action, actorIds).filter((o) => !o.disabledReason).length
  return Math.min(action.nombre ?? 1, valid)
}

function isAnswered(s: GameState, action: ActionDef, value: SelectionValue | undefined, actorIds: string[]) {
  if (action.type === 'oui_non') return typeof value === 'boolean'
  if (action.type === 'choix') return typeof value === 'string'
  const needed = neededCount(s, action, actorIds)
  if (needed === 0) return true
  if (value === null) return !!action.optionnel
  return Array.isArray(value) && value.length === needed
}

/** Résultat calculé pour la Voyante et le Renard (avec révélation des rôles inconnus). */
function ActionResult({ action, value }: { action: ActionDef; value: SelectionValue | undefined }) {
  const { game } = useCurrentGame()
  const targetId = Array.isArray(value) ? value[0] : undefined
  const target = playerById(game, targetId)
  if (!target) return null

  if (action.effet === 'voyance') {
    if (!target.roleId) return <RevealPanel player={target} />
    const role = getRole(target.roleId)
    return (
      <div className="space-y-2">
        <BigResult>
          {target.name} est {role.emoji} {role.nom}
        </BigResult>
        {(target.infected || target.turnedWolf) && (
          <Hint>{target.name} est aussi loup en secret, mais la Voyante ne voit que sa carte d’origine.</Hint>
        )}
      </div>
    )
  }

  if (action.effet === 'flair') {
    const group = foxGroup(game, target.id)
    const unknown = group.find((p) => !p.roleId)
    if (unknown) return <RevealPanel player={unknown} />
    const yes = group.some(isWolf)
    return (
      <div className="space-y-2">
        <Hint>Groupe flairé : {group.map((p) => p.name).join(', ')}</Hint>
        {yes ? (
          <BigResult tone="yes">👍 OUI — fais un signe positif</BigResult>
        ) : (
          <>
            <BigResult tone="no">👎 NON — fais un signe négatif</BigResult>
            <Banner tone="danger">🦊 Aucun loup : le Renard perd définitivement son pouvoir.</Banner>
          </>
        )}
      </div>
    )
  }
  return null
}

function ActionInput({
  action,
  value,
  actorIds,
  onChange,
}: {
  action: ActionDef
  value: SelectionValue | undefined
  actorIds: string[]
  onChange: (v: SelectionValue) => void
}) {
  const { game } = useCurrentGame()

  if (action.type === 'oui_non') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant={value === true ? 'danger' : 'secondary'} onClick={() => onChange(true)}>
          {value === true && '✓ '}Oui
        </Button>
        <Button variant={value === false ? 'primary' : 'secondary'} onClick={() => onChange(false)}>
          {value === false && '✓ '}Non
        </Button>
      </div>
    )
  }

  if (action.type === 'choix') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {action.options?.map((o) => (
          <Button key={o.valeur} variant={value === o.valeur ? 'primary' : 'secondary'} onClick={() => onChange(o.valeur)}>
            {o.libelle}
          </Button>
        ))}
      </div>
    )
  }

  const options = pickerOptions(game, action, actorIds)
  const count = neededCount(game, action, actorIds)
  if (count === 0) {
    return (
      <Card>
        <p className="text-night-400">
          {action.source === 'victimes_nuit' ? 'Aucune victime à sauver cette nuit.' : 'Aucun joueur ne peut être choisi.'}
        </p>
      </Card>
    )
  }
  return (
    <div className="space-y-2">
      {(action.nombre ?? 1) > count && <Hint>Il ne reste que {count} joueur(s) possible(s).</Hint>}
      <PlayerPicker
        options={options}
        count={count}
        value={Array.isArray(value) ? value : []}
        onChange={(ids) => onChange(ids)}
        allowNew={action.source !== 'victimes_nuit'}
      />
      {action.optionnel && (
        <Button variant={value === null ? 'primary' : 'ghost'} className="w-full" onClick={() => onChange(null)}>
          {value === null && '✓ '}Personne
        </Button>
      )}
    </div>
  )
}

function WitchInfo() {
  const { game } = useCurrentGame()
  const victims = nightVictims(game)
  return (
    <div className="space-y-2">
      {victims.length ? (
        <Banner tone="danger">
          🩸 Montre-lui la victime de cette nuit :{' '}
          <b>{victims.map((id) => playerById(game, id)!.name).join(' et ')}</b>
        </Banner>
      ) : (
        <Banner tone="info">🌙 Aucune victime cette nuit : ne montre personne.</Banner>
      )}
      <Hint>
        Potion de vie : {game.powers.witchLife ? '✅ disponible' : '❌ utilisée'} · Potion de mort :{' '}
        {game.powers.witchDeath ? '✅ disponible' : '❌ utilisée'}
      </Hint>
    </div>
  )
}

export function StepScreen({ step }: { step: NightStep }) {
  const { game, dispatch } = useCurrentGame()
  const [sel, setSel] = useState<Selections>({})
  const role = getRole(step.roleId)
  const status = stepStatus(game, step)
  const actors = stepActors(game, step)
  const actorIds = actors.map((p) => p.id)
  const companion = step.kind === 'amoureux' || step.kind === 'charmes' ? role.compagnon : undefined
  const villagers = step.kind === 'villageois'

  const header = villagers
    ? { emoji: '🧑‍🌾', nom: 'Joueurs restants', reveil: '', coucher: '', desc: 'Saisis les prénoms des joueurs qui ne se sont pas encore réveillés : ce sont les Simples Villageois.' }
    : {
        emoji: (companion ?? role).emoji,
        nom: (companion ?? role).nom,
        reveil: (companion ?? role).phrase_reveil,
        coucher: (companion ?? role).phrase_coucher,
        desc: (companion ?? role).description_courte,
      }

  const actions =
    status === 'active'
      ? availableActions(game, step).filter((a) => {
          if (!a.dependDe) return true
          const dep = sel[a.dependDe]
          return Array.isArray(dep) && dep.length > 0
        })
      : []

  const pendingReveal = actions.some((a) => {
    const t = playerById(game, Array.isArray(sel[a.id]) ? (sel[a.id] as string[])[0] : undefined)
    if (!t) return false
    if (a.effet === 'voyance') return !t.roleId
    if (a.effet === 'flair') return foxGroup(game, t.id).some((p) => !p.roleId)
    return false
  })
  const ready = status !== 'identify' && !pendingReveal && actions.every((a) => isAnswered(game, a, sel[a.id], actorIds))

  const finish = () => {
    // Une action dépendante masquée (ex. infection sans victime) ne doit pas être envoyée.
    const visible = new Set(actions.map((a) => a.id))
    dispatch({ type: 'COMPLETE_STEP', selections: Object.fromEntries(Object.entries(sel).filter(([k]) => visible.has(k))) })
  }

  return (
    <div className="space-y-4 animate-rise">
      <div className="pt-2 text-center">
        <div className="text-7xl" aria-hidden>
          {header.emoji}
        </div>
        <h1 className="mt-2 font-tale text-4xl leading-tight font-bold text-moon">{header.nom}</h1>
      </div>

      {header.reveil && <Phrase label="Réveil">{header.reveil}</Phrase>}
      <Hint>{header.desc}</Hint>

      {status === 'identify' && <IdentifyPanel roleIds={rolesToIdentify(game, step)} />}

      {status === 'dead' && (
        <Banner tone="warning">
          ⚠️ <b>Rôle mort</b> : appelle-le quand même pour ne rien révéler, attends quelques secondes, puis passe.
        </Banner>
      )}

      {status === 'power_lost' && (
        <Banner tone="warning">
          ⚠️ <b>Pouvoir perdu ou épuisé</b> : appelle-le quand même pour la forme, attends quelques secondes, puis passe.
        </Banner>
      )}

      {status === 'active' && (
        <>
          {!villagers && actors.length > 0 && (
            <Card>
              <SectionTitle>{companion ? 'Touche la tête de' : 'Se réveille(nt)'}</SectionTitle>
              <ul className="space-y-1">
                {actors.map((p) => (
                  <li key={p.id} className="text-lg">
                    <b>{p.name}</b> <span className="text-sm text-night-400">{roleLabel(p)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {villagers && <Banner tone="success">✅ Tous les joueurs sont identifiés.</Banner>}
          {role.meute && game.players.some((p) => p.alive && p.roleId === 'petite_fille') && (
            <Hint>👧 La Petite fille peut entrouvrir les yeux pour espionner les loups.</Hint>
          )}
          {step.kind === 'role' && role.id === 'sorciere' && <WitchInfo />}

          {actions.map((a) => (
            <div key={a.id} className="space-y-3">
              <SectionTitle>{a.libelle}</SectionTitle>
              <ActionInput
                action={a}
                value={sel[a.id]}
                actorIds={actorIds}
                onChange={(v) => setSel((prev) => ({ ...prev, [a.id]: v }))}
              />
              <ActionResult action={a} value={sel[a.id]} />
            </div>
          ))}
        </>
      )}

      {header.coucher && status !== 'identify' && <Phrase label="Coucher">{header.coucher}</Phrase>}

      {status !== 'identify' && (
        <MainAction onClick={finish} disabled={!ready}>
          {villagers ? 'Terminer la nuit ☀️' : 'Terminé ✓'}
        </MainAction>
      )}
    </div>
  )
}
