// iOS can bring an installed app back from the background still zoomed in, and nothing
// on the page can undo it. Pinning maximum-scale for a moment snaps WebKit back to 1;
// the normal tag then goes back so readers can still pinch to zoom.
export default defineNuxtPlugin(() => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const viewport = window.visualViewport
  const installed = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!meta || !viewport || !installed) return

  const normal = meta.content
  function resetZoom() {
    if (document.visibilityState !== 'visible' || Math.abs(viewport!.scale - 1) < 0.01) return
    meta!.content = `${normal}, maximum-scale=1`
    setTimeout(() => {
      meta!.content = normal
    }, 300)
  }

  // WebKit restores the stale scale a moment after the app shows, so look again shortly after
  function onResume() {
    if (document.visibilityState !== 'visible') return
    for (const delay of [0, 300, 1000]) setTimeout(resetZoom, delay)
  }

  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('pageshow', onResume)
  window.addEventListener('orientationchange', onResume)
})
