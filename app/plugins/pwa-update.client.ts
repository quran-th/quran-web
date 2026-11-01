import { useRecitationStore } from '~/stores/recitationStore'

/**
 * Applies a new release as soon as it's available: re-checks the service
 * worker when the app returns to the foreground and reloads once the new
 * worker takes control, so users never keep running a stale bundle.
 * The reload waits for recitation to stop so audio isn't cut off.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (!('serviceWorker' in navigator)) return

  // No controller yet = first install, nothing stale to replace
  const hadController = !!navigator.serviceWorker.controller
  const recitation = useRecitationStore(nuxtApp.$pinia as never)
  let reloadPending = false

  function reloadWhenIdle() {
    if (recitation.status === 'idle') {
      window.location.reload()
      return
    }
    if (reloadPending) return
    reloadPending = true
    const stop = watch(() => recitation.status, (s) => {
      if (s !== 'idle') return
      stop()
      window.location.reload()
    })
  }

  if (hadController) {
    navigator.serviceWorker.addEventListener('controllerchange', reloadWhenIdle)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    navigator.serviceWorker.getRegistration().then(reg => reg?.update()).catch(() => {})
  })
})
