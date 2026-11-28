import { computed, ref } from 'vue'
import { pwaPlatform, type PwaPlatform } from '~/utils/pwaPlatform'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
  prompt: () => Promise<void>
}

// The badge shows at most once per 3 days, counted from when it last appeared (not from a dismiss), so ignoring it
// does not bring it back on every visit.
const STORAGE_KEY = 'pwa-install-shown-at'
const REPROMPT_AFTER_MS = 3 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 10 * 1000
// Chrome hands over its install prompt only after some engagement with the page; until then the Android sheet waits
// with a "preparing" button, and after this long it falls back to the menu steps.
const PROMPT_WAIT_MS = 30 * 1000

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)
const platform = ref<PwaPlatform>({ kind: 'none' })
const shownRecently = ref(false)
const dismissed = ref(false)
const ready = ref(false)
const delayElapsed = ref(false)
let bootAt = 0
let previewing = false

function detectStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  return document.referrer.startsWith('android-app://')
}

function readShownRecently(): boolean {
  try {
    const ts = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '', 10)
    return Number.isFinite(ts) && Date.now() - ts < REPROMPT_AFTER_MS
  }
  catch {
    return false
  }
}

function fakePrompt(): BeforeInstallPromptEvent {
  // The answer comes 2 s after the tap, like a person reading Chrome's dialog.
  const fake = {
    platforms: [],
    userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    prompt: async () => {
      fake.userChoice = new Promise(resolve => setTimeout(() => resolve({ outcome: 'accepted', platform: 'web' }), 2000))
    },
  }
  return fake as unknown as BeforeInstallPromptEvent
}

// Dev preview via ?pwa=<case>: forces one branch and skips the delay and the 3-day rule, so each sheet can be checked
// on a desktop browser.
const PREVIEWS: Record<string, { platform: PwaPlatform, prompt?: boolean }> = {
  'ios26': { platform: { kind: 'ios', safari: true, menuInMore: true } },
  'ios': { platform: { kind: 'ios', safari: true, menuInMore: false } },
  'ios-chrome': { platform: { kind: 'ios', safari: false, menuInMore: false } },
  'line': { platform: { kind: 'in-app', app: 'line', os: 'ios', browser: 'Safari' } },
  'line-android': { platform: { kind: 'in-app', app: 'line', os: 'android', browser: 'Chrome' } },
  'android': { platform: { kind: 'android', prompts: true }, prompt: true },
  'android-wait': { platform: { kind: 'android', prompts: true } },
  'android-noprompt': { platform: { kind: 'android', prompts: false } },
  'desktop': { platform: { kind: 'desktop' }, prompt: true },
}

let initialized = false

// Run once on the client at app boot (plugins/pwa-install.client.ts): Chrome may fire beforeinstallprompt before any
// <ClientOnly> component hydrates, so the listener cannot wait for the component.
export function initPwaInstall(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  bootAt = Date.now()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    installed.value = true
  })

  const preview = PREVIEWS[new URLSearchParams(window.location.search).get('pwa') ?? '']
  if (preview) {
    previewing = true
    platform.value = preview.platform
    deferredPrompt.value = preview.prompt ? fakePrompt() : null
    delayElapsed.value = true
    ready.value = true
    return
  }

  platform.value = pwaPlatform(window.navigator.userAgent, {
    standalone: detectStandalone(),
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
  })
  shownRecently.value = readShownRecently()
  ready.value = true
  setTimeout(() => {
    delayElapsed.value = true
  }, SHOW_DELAY_MS)
}

export function usePwaInstall() {
  initPwaInstall()

  const canShow = computed(() => {
    if (!ready.value || !delayElapsed.value || shownRecently.value || dismissed.value || installed.value) return false
    const kind = platform.value.kind
    if (kind === 'none' || kind === 'unsupported') return false
    // Desktop has no steps worth drawing: offer it only when the browser's own install prompt is ready.
    if (kind === 'desktop') return deferredPrompt.value !== null
    return true
  })

  function noteShown() {
    if (previewing) return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }
    catch {
      // localStorage unavailable (private mode): the badge may come back next visit.
    }
  }

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = deferredPrompt.value
    if (!event) return 'unavailable'
    deferredPrompt.value = null // a prompt can be used once
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') installed.value = true
      return outcome
    }
    catch (err) {
      console.error('PWA install prompt failed:', err)
      return 'unavailable'
    }
  }

  function dismiss() {
    dismissed.value = true
  }

  return {
    canShow,
    platform,
    installed,
    hasDeferredPrompt: computed(() => deferredPrompt.value !== null),
    promptWaitLeft: () => Math.max(0, PROMPT_WAIT_MS - (Date.now() - bootAt)),
    noteShown,
    promptInstall,
    dismiss,
  }
}
