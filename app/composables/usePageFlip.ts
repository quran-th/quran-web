import { nextTick } from 'vue'

let flipping = false

/**
 * Runs a page turn as a view transition so the spread halves can animate as a
 * turning leaf (see main.css). Browsers without the API (Safari before 18, so every
 * iPad stuck on iPadOS 17) slide the new page in instead. Instant when the user
 * prefers reduced motion or a flip is already running.
 */
export async function flipPage(direction: 'next' | 'prev', update: () => unknown | Promise<unknown>) {
  if (flipping || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await update()
    return
  }
  if (typeof document.startViewTransition !== 'function') {
    await update()
    await nextTick()
    slideInNewPage(direction)
    return
  }

  flipping = true
  const root = document.documentElement
  root.dataset.flip = direction
  const transition = document.startViewTransition(async () => {
    await update()
    await nextTick()
  })
  transition.finished.finally(() => {
    delete root.dataset.flip
    flipping = false
  })
  await transition.updateCallbackDone.catch(() => {})
}

/**
 * The paper stays put while the new page's text slides in from the side the leaf turns
 * from: the next page lies to the left in a Mushaf. Uses `translate`, not `transform`,
 * so the layers keep their own centring transforms.
 */
function slideInNewPage(direction: 'next' | 'prev') {
  const sheet = document.querySelector<HTMLElement>('.book-sheet')
  if (!sheet) return
  const from = direction === 'next' ? '-24px 0' : '24px 0'
  for (const layer of Array.from(sheet.children)) {
    if (!(layer instanceof HTMLElement) || layer.getAttribute('aria-hidden') === 'true') continue
    if (getComputedStyle(layer).visibility === 'hidden') continue
    layer.animate(
      [{ opacity: 0, translate: from }, { opacity: 1, translate: '0 0' }],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }
}
