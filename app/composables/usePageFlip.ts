import { nextTick } from 'vue'

let flipping = false

/** Marks a layer a swipe is dragging, so whatever turns the page can take the drag offset off */
export const DRAG_ATTR = 'data-swipe-drag'

/** Drops the swipe drag offset at once, for the moment the new page goes in */
export function releaseDrag() {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[${DRAG_ATTR}]`))) {
    el.style.translate = ''
    el.removeAttribute(DRAG_ATTR)
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Runs a page turn as a view transition so the spread halves can animate as a
 * turning leaf (see main.css). Browsers without the API (Safari before 18, so every
 * iPad stuck on iPadOS 17) slide the new page in instead. Instant when the user
 * prefers reduced motion or a flip is already running.
 */
export async function flipPage(direction: 'next' | 'prev', update: () => unknown | Promise<unknown>) {
  if (flipping || reducedMotion()) {
    releaseDrag()
    await update()
    return
  }
  if (typeof document.startViewTransition !== 'function') {
    releaseDrag()
    // The page number changes before its words arrive, so slide the new page in now
    // rather than after the load, or the turn shows nothing until the network answers
    const done = update()
    await nextTick()
    slideIn(sheetLayers(), direction)
    await done
    return
  }

  flipping = true
  const root = document.documentElement
  root.dataset.flip = direction
  const transition = document.startViewTransition(async () => {
    releaseDrag()
    await update()
    await nextTick()
  })
  transition.finished.finally(() => {
    delete root.dataset.flip
    flipping = false
  })
  await transition.updateCallbackDone.catch(() => {})
}

/** The spread's showing layers (the Mushaf pages or the book), not the spine or a hidden layer */
export function sheetLayers(): HTMLElement[] {
  const sheet = document.querySelector<HTMLElement>('.book-sheet')
  if (!sheet) return []
  return Array.from(sheet.children).filter((layer): layer is HTMLElement =>
    layer instanceof HTMLElement
    && layer.getAttribute('aria-hidden') !== 'true'
    && getComputedStyle(layer).visibility !== 'hidden')
}

/**
 * The paper stays put while the new page's text slides in from the side the leaf turns
 * from: the next page lies to the left in a Mushaf. Uses `translate`, not `transform`,
 * so the layers keep their own centring transforms.
 */
export function slideIn(layers: HTMLElement[], direction: 'next' | 'prev') {
  if (reducedMotion()) return
  const from = direction === 'next' ? '-24px 0' : '24px 0'
  for (const layer of layers) {
    layer.animate(
      [{ opacity: 0, translate: from }, { opacity: 1, translate: '0 0' }],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }
}
