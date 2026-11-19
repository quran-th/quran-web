import { nextTick } from 'vue'

let flipping = false

/**
 * Runs a page turn as a view transition so the spread halves can animate as a
 * turning leaf (see main.css). Falls back to an instant update when the
 * browser lacks the API, the user prefers reduced motion, or a flip is running.
 */
export async function flipPage(direction: 'next' | 'prev', update: () => unknown | Promise<unknown>) {
  if (
    flipping
    || typeof document.startViewTransition !== 'function'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    await update()
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
