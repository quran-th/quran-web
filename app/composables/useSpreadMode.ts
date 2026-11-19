import { onBeforeUnmount, onMounted, ref } from 'vue'

const SPREAD_QUERY = '(orientation: landscape) and (min-width: 1024px)'
const PANE_QUERY = '(min-width: 768px)'

function useMediaQuery(query: string) {
  // Client-side navigation can read the viewport now; SSR and hydration must start false
  const canReadNow = import.meta.client && !useNuxtApp().isHydrating
  const matches = ref(canReadNow ? window.matchMedia(query).matches : false)
  let mql: MediaQueryList | null = null

  function handleChange(e: MediaQueryListEvent) {
    matches.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', handleChange)
  })

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', handleChange)
  })

  return matches
}

/** True when the viewport is wide enough for the two-page Mushaf spread. False during SSR. */
export function useSpreadMode() {
  return useMediaQuery(SPREAD_QUERY)
}

/** True from tablet width up, where a single page has room for a translation pane beside it. False during SSR. */
export function usePaneMode() {
  return useMediaQuery(PANE_QUERY)
}
