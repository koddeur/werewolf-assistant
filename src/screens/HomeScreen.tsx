import { MainAction } from '../components/ui'

type Platform = 'ios' | 'android' | null

function isInstalledApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true // iOS Safari
  )
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

/** Pictos inspirés des boutons réels de Safari / Chrome, pour les retrouver d'un coup d'œil. */
const ICONS = {
  browser: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  share: (
    <>
      <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v8A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 9H16" />
      <path d="M12 3v11M8.5 6.5 12 3l3.5 3.5" />
    </>
  ),
  addHome: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  menu: (
    <g fill="currentColor" stroke="none">
      <circle cx="12" cy="5.5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="18.5" r="1.8" />
    </g>
  ),
  install: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M12 7v7M9 11l3 3 3-3" />
    </>
  ),
}

type Step = { icon: keyof typeof ICONS | null; text: string; button?: string }

const STEPS: Record<'ios' | 'android', Step[]> = {
  ios: [
    { icon: 'browser', text: 'Ouvre cette page dans Safari.' },
    { icon: 'share', text: 'Touche le bouton Partager (en bas de l’écran, ou en haut sur iPad).' },
    { icon: 'addHome', text: 'Choisis « Sur l’écran d’accueil ».' },
    { icon: null, button: 'Ajouter', text: 'Touche « Ajouter » en haut à droite.' },
  ],
  android: [
    { icon: 'browser', text: 'Ouvre cette page dans Chrome.' },
    { icon: 'menu', text: 'Touche le menu ⋮ en haut à droite.' },
    { icon: 'install', text: 'Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).' },
    { icon: null, button: 'Installer', text: 'Confirme avec « Installer ».' },
  ],
}

function StepVisual({ step }: { step: Step }) {
  if (step.button) {
    return <span className="rounded-lg bg-sky-500 px-2 py-1 text-sm font-semibold text-white">{step.button}</span>
  }
  if (!step.icon) return null
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[step.icon]}
    </svg>
  )
}

function InstallTip() {
  const platform = detectPlatform()
  if (!platform || isInstalledApp()) return null
  return (
    <details className="rounded-2xl bg-night-800 p-4 text-left">
      <summary className="cursor-pointer text-lg font-semibold">📲 Installe l’app</summary>
      <p className="mt-2 text-night-400">Plein écran et utilisable sans connexion.</p>
      <ol className="mt-3 space-y-2">
        {STEPS[platform].map((step, i) => (
          <li key={step.text} className="flex items-center gap-3">
            <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-night-950">
              <StepVisual step={step} />
            </span>
            <span className="text-lg leading-snug">
              <b className="text-moon">{i + 1}.</b> {step.text}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col animate-rise">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-8xl" aria-hidden>
          🐺
        </div>
        <h1 className="mt-4 font-tale text-5xl font-bold text-moon">Loup-Garou</h1>
        <p className="mt-2 text-xl text-night-400">Assistant du narrateur</p>
      </div>
      <InstallTip />
      <MainAction onClick={onStart}>Démarrer une partie</MainAction>
    </div>
  )
}
