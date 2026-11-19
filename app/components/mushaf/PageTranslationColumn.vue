<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePageTranslations } from '~/composables/usePageTranslations'
import { useRecitationStore } from '~/stores/recitationStore'

interface Props {
  page: number
  /** Which side of the spread; the scroll line always sits on the edge facing the page */
  side: 'left' | 'right'
  /** The verse tapped on the Mushaf page; both columns get it, only the one holding it reacts */
  focusedVerse?: { key: string } | null
}

const props = defineProps<Props>()

const { verses, segments } = usePageTranslations(toRef(props, 'page'))


const scroller = ref<HTMLElement | null>(null)

const { activeVerseKey, status } = storeToRefs(useRecitationStore())
const playingKey = computed(() => (status.value === 'playing' ? activeVerseKey.value : null))

// The scroller's mask fades 12px at the top and 80px at the bottom; centre the verse in the clear band between
const FADE_TOP = 12
const FADE_BOTTOM = 80

function revealVerse(key: string | null | undefined) {
  const el = scroller.value
  const row = key ? el?.querySelector<HTMLElement>(`[data-verse-key="${key}"]`) : null
  if (!el || !row) return
  const clear = el.clientHeight - FADE_TOP - FADE_BOTTOM
  const rowTop = row.getBoundingClientRect().top - el.getBoundingClientRect().top
  const offset = FADE_TOP + Math.max(4, (clear - row.offsetHeight) / 2)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({ top: rowTop - offset, behavior: reduceMotion ? 'auto' : 'smooth' })
}

watch(() => props.focusedVerse, focus => revealVerse(focus?.key))
watch(playingKey, revealVerse)
const canScrollMore = ref(false)

function updateScrollState() {
  const el = scroller.value
  canScrollMore.value = !!el && el.scrollTop + el.clientHeight < el.scrollHeight - 4
}

function scrollDown() {
  const el = scroller.value
  if (el) el.scrollBy({ top: el.clientHeight * 0.8, behavior: 'smooth' })
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!scroller.value) return
  resizeObserver = new ResizeObserver(updateScrollState)
  resizeObserver.observe(scroller.value)
  updateScrollState()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.page, () => {
  scroller.value?.scrollTo({ top: 0 })
})

watch(verses, async () => {
  await nextTick()
  updateScrollState()
  revealVerse(props.focusedVerse?.key ?? playingKey.value)
})
</script>

<template>
  <aside :aria-label="`คำแปลหน้า ${page}`" class="@container flex min-w-[184px] max-w-[460px] flex-[1_1_236px] flex-col">
    <div class="relative min-h-0 flex-1">
      <div
        ref="scroller"
        :dir="side === 'right' ? 'rtl' : 'ltr'"
        class="scrollbar-dot absolute inset-x-0 top-4 bottom-0 overflow-y-scroll px-3 pt-3 @min-[236px]:px-[18px] pb-[64px] [mask-image:linear-gradient(to_bottom,transparent,#000_12px,#000_calc(100%-80px),transparent_calc(100%-36px))]"
        @scroll.passive="updateScrollState"
      >
        <!-- Pages 1–2 are centred short pages, so their translation sits centred beside them -->
        <div dir="ltr" :class="page <= 2 ? 'flex min-h-full flex-col justify-center' : ''">
          <MushafPageTranslationVerses :verses="verses" size="column" :highlight-key="focusedVerse?.key" />
        </div>
      </div>
      <!-- Floats on the scroller's faded tail so the footer holds only the caption -->
      <button
        type="button"
        :class="{ invisible: !canScrollMore }"
        class="absolute bottom-0.5 left-3 flex h-7 cursor-pointer items-center gap-1 pr-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink-icon @min-[236px]:left-[18px]"
        @click="scrollDown"
      >
        อ่านต่อ
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
    </div>
    <div class="flex flex-col pt-1 pr-3 pb-3.5 pl-3 @min-[236px]:pl-[18px]">
      <div class="min-h-4 text-xs tracking-[0.02em] text-ink-muted">
        <span v-for="s in segments" :key="s.surahNumber" class="block">
          {{ s.surahNumber }} · {{ s.name }} · <span class="whitespace-nowrap"><span class="hidden @min-[236px]:inline">อายะห์ </span>{{ s.from }}–{{ s.to }}</span>
        </span>
      </div>
    </div>
  </aside>
</template>
