import { DRAG_ATTR } from '~/composables/usePageFlip'

type Direction = 'next' | 'prev'

interface SwipeTurnOptions {
  /** False while turning is blocked (a sheet or modal is open, or another layer owns the swipe) */
  enabled: () => boolean
  /** Whether there is a page that way; a swipe toward the end only gives a little, then eases back */
  canTurn: (direction: Direction) => boolean
  /** The elements that follow the finger */
  layers: () => HTMLElement[]
  turn: (direction: Direction) => void
}

// Past this the gesture is read as horizontal or vertical for good
const LOCK_PX = 10
const TURN_PX = 50
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Swipe to turn, with the page following the finger from the first few pixels so a
 * reader sees the swipe taken before the new page is ready. Mushaf direction: a swipe
 * to the right turns to the next page.
 */
export function useSwipeTurn(options: SwipeTurnOptions) {
  let start: { x: number, y: number } | null = null
  let axis: 'x' | 'y' | null = null
  let dragged: HTMLElement[] = []

  // A pinch-zoomed reader is panning the page, not turning it
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01

  // Gives less the further it goes, and far less where there is no page to turn to
  function resist(dx: number) {
    const open = options.canTurn(dx > 0 ? 'next' : 'prev')
    const reach = open ? 56 : 18
    const pull = open ? 0.5 : 0.2
    return Math.sign(dx) * reach * Math.tanh((Math.abs(dx) * pull) / reach)
  }

  function springBack(layers?: HTMLElement[]) {
    // Called with a turn's layers, it leaves alone any of them a newer swipe has taken hold of
    const own = !layers
    if (own) {
      layers = dragged
      dragged = []
    }
    for (const el of layers!) {
      if (!el.hasAttribute(DRAG_ATTR) || (!own && dragged.includes(el))) continue
      const from = el.style.translate
      el.style.translate = ''
      el.removeAttribute(DRAG_ATTR)
      if (from && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.animate([{ translate: from }, { translate: '0 0' }], { duration: 220, easing: EASE })
      }
    }
  }

  // The rest of a touch goes to the element it started on, even after that element leaves the
  // page (a word redrawn once its font loads), and from there it no longer bubbles up to the
  // reader. Listening on that element itself still hears the lift, so the page never stays pulled aside
  let tracked: EventTarget | null = null

  function track(target: EventTarget | null) {
    untrack()
    if (!target) return
    tracked = target
    target.addEventListener('touchmove', onTouchMove as EventListener, { passive: true })
    target.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })
    target.addEventListener('touchcancel', reset, { passive: true })
  }

  function untrack() {
    tracked?.removeEventListener('touchmove', onTouchMove as EventListener)
    tracked?.removeEventListener('touchend', onTouchEnd as EventListener)
    tracked?.removeEventListener('touchcancel', reset)
    tracked = null
  }

  function reset() {
    untrack()
    springBack()
    start = null
    axis = null
  }

  function onTouchStart(e: TouchEvent) {
    // Whatever the last gesture left pulled aside goes back first
    reset()
    const t = e.touches[0]
    if (e.touches.length !== 1 || !t || !options.enabled() || zoomed()) return
    start = { x: t.clientX, y: t.clientY }
    axis = null
    track(e.target)
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    if (!start || !t) return
    if (e.touches.length !== 1) {
      reset()
      return
    }
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (!axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axis !== 'x') return
    if (!dragged.length) {
      dragged = options.layers()
      for (const el of dragged) {
        // A slide-in still running would hold the layer where it is
        for (const animation of el.getAnimations()) {
          if (!('transitionProperty' in animation) && !('animationName' in animation)) animation.finish()
        }
        el.setAttribute(DRAG_ATTR, '')
      }
    }
    const offset = `${resist(dx)}px 0`
    for (const el of dragged) el.style.translate = offset
  }

  function onTouchEnd(e: TouchEvent) {
    const t = e.changedTouches[0]
    untrack()
    if (!start || !t) {
      reset()
      return
    }
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const horizontal = axis ? axis === 'x' : Math.abs(dx) > Math.abs(dy)
    const direction: Direction = dx > 0 ? 'next' : 'prev'
    start = null
    axis = null
    if (!horizontal || Math.abs(dx) < TURN_PX || !options.enabled() || !options.canTurn(direction)) {
      springBack()
      return
    }
    const layers = dragged
    dragged = []
    options.turn(direction)
    // The turn takes the offset off as the new page goes in; if it turned nowhere after all, ease back
    setTimeout(() => springBack(layers), 400)
  }

  return { onTouchStart }
}
