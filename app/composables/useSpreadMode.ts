import { onBeforeUnmount, onMounted, ref } from 'vue'

const SPREAD_QUERY = '(orientation: landscape) and (min-width: 1024px)'

/** True when the viewport is wide enough for the two-page Mushaf spread. False during SSR. */
export function useSpreadMode() {
  const isSpread = ref(false)
  let mql: MediaQueryList | null = null

  function handleChange(e: MediaQueryListEvent) {
    isSpread.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia(SPREAD_QUERY)
    isSpread.value = mql.matches
    mql.addEventListener('change', handleChange)
  })

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', handleChange)
  })

  return isSpread
}
