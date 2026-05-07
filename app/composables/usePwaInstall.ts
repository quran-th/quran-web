import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Platform = 'ios' | 'android' | 'desktop' | 'unsupported'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
  prompt: () => Promise<void>
}

const STORAGE_KEY = 'pwa-install-dismissed-at'
const REPROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SHOW_DELAY_MS = 10 * 1000 // 10 seconds on-page before prompting

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isStandalone = ref(false)
const platform = ref<Platform>('unsupported')
const dismissedRecently = ref(false)
const ready = ref(false)
const delayElapsed = ref(false)
let listenersAttached = false
const delayTimer: { id: ReturnType<typeof setTimeout> | null } = { id: null }

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari sets navigator.standalone when launched from home screen
  const navAny = window.navigator as unknown as { standalone?: boolean }
  if (navAny.standalone === true) return true
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) return true
  return false
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unsupported'
  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua) && !/Windows/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  // Safari on macOS has no install API — hide rather than show dead UI.
  const isMacSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua) && /Macintosh/i.test(ua)
  if (isMacSafari) return 'unsupported'
  return 'desktop'
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const ts = Number.parseInt(raw, 10)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < REPROMPT_AFTER_MS
  }
  catch {
    return false
  }
}

function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true

  const onBeforeInstall = (event: Event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  }

  const onInstalled = () => {
    deferredPrompt.value = null
    isStandalone.value = true
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
  window.addEventListener('appinstalled', onInstalled)
}

// Dev-only preview overrides via ?pwa=ios|android|fallback
// Forces a specific render branch and bypasses delay + dismissal so the modal
// can be inspected without device juggling. Remove before production.
function readPreviewOverride(): 'ios' | 'android' | 'fallback' | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('pwa')
  if (value === 'ios' || value === 'android' || value === 'fallback') return value
  return null
}

export function usePwaInstall() {
  onMounted(() => {
    isStandalone.value = detectStandalone()
    platform.value = detectPlatform()
    dismissedRecently.value = readDismissed()
    attachListeners()
    ready.value = true

    const preview = readPreviewOverride()
    if (preview) {
      isStandalone.value = false
      dismissedRecently.value = false
      delayElapsed.value = true
      if (preview === 'ios') {
        platform.value = 'ios'
        deferredPrompt.value = null
      }
      else if (preview === 'android') {
        platform.value = 'android'
        deferredPrompt.value = {
          platforms: [],
          userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
          prompt: async () => {},
        } as unknown as BeforeInstallPromptEvent
      }
      else {
        platform.value = 'android'
        deferredPrompt.value = null
      }
      return
    }

    // Delay first appearance so users aren't interrupted on landing.
    // Skip the timer if it's already running or elapsed (e.g. after a route change).
    if (!delayElapsed.value && delayTimer.id === null) {
      delayTimer.id = setTimeout(() => {
        delayElapsed.value = true
        delayTimer.id = null
      }, SHOW_DELAY_MS)
    }
  })

  onBeforeUnmount(() => {
    // Listeners are global; leave attached so the deferred prompt is preserved
    // across route changes / component re-mounts.
  })

  const canShow = computed(() => {
    if (!ready.value) return false
    if (!delayElapsed.value) return false
    if (isStandalone.value) return false
    if (dismissedRecently.value) return false
    if (platform.value === 'unsupported') return false
    return true
  })

  async function triggerInstall(): Promise<void> {
    const evt = deferredPrompt.value
    if (!evt) return
    try {
      await evt.prompt()
      const choice = await evt.userChoice
      deferredPrompt.value = null
      if (choice.outcome === 'dismissed') {
        dismiss()
      }
    }
    catch (err) {
      console.error('PWA install prompt failed:', err)
    }
  }

  function dismiss() {
    dismissedRecently.value = true
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }
    catch {
      // localStorage unavailable (private mode) — in-memory dismiss is enough.
    }
  }

  return {
    canShow,
    platform,
    isStandalone,
    hasDeferredPrompt: computed(() => deferredPrompt.value !== null),
    triggerInstall,
    dismiss,
  }
}
