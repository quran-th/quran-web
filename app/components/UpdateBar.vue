<script setup lang="ts">
import { useRecitationStore } from '~/stores/recitationStore'

// An installed app resumes from memory and never reloads, so it kept an old release for days.
// The page compares the build it was loaded with against the deployed one when it comes back
// to the screen (at most once a minute) and every 10 minutes while it shows.
const MIN_GAP_MS = 60_000
const EVERY_MS = 10 * 60_000

const { t } = useI18n()
const build = String(useRuntimeConfig().public.buildId ?? '')
const recitation = useRecitationStore()
// Set by RecitationPlayerBar while its Thai audio notice shows above the player
const translationIssueShown = useState('translation-issue-shown', () => false)
const stale = ref(false)

let last = Date.now()
async function check() {
  if (stale.value || !build || document.visibilityState !== 'visible' || Date.now() - last < MIN_GAP_MS) return
  last = Date.now()
  try {
    const res = await $fetch<{ build?: unknown }>('/api/version', { cache: 'no-store' })
    if (typeof res.build !== 'string' || res.build === build) return
    stale.value = true
    // Fetch the new service worker now; pwa-update reloads by itself once nothing is playing
    navigator.serviceWorker?.getRegistration().then(reg => reg?.update()).catch(() => {})
  }
  catch {
    // offline: try again when the page next comes back
  }
}

// Once stale, a tap on an internal link loads the next page in full, unless that would cut
// off the recitation the reader is listening to
function onLinkClick(event: MouseEvent) {
  if (!stale.value || recitation.status !== 'idle') return
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
  const url = new URL(link.href)
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  event.stopPropagation()
  window.location.assign(url.href)
}

function reloadNow() {
  window.location.reload()
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(check, EVERY_MS)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  window.addEventListener('click', onLinkClick, true)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', check)
  window.removeEventListener('focus', check)
  window.removeEventListener('online', check)
  window.removeEventListener('click', onLinkClick, true)
})
</script>

<template>
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-200 ease-out"
  >
    <div
      v-if="stale"
      role="status"
      class="fixed inset-x-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-800 py-2 pl-4 pr-2 text-white shadow-xl"
      :class="recitation.status === 'idle' ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]' : translationIssueShown ? 'bottom-40' : 'bottom-24'"
    >
      <span class="min-w-0 flex-1 text-sm font-medium">{{ t('app_update.ready') }}</span>
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        @click="reloadNow"
      >
        {{ t('app_update.update') }}
      </button>
    </div>
  </Transition>
</template>
