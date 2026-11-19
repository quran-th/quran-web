<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { usePageTranslations } from '~/composables/usePageTranslations'

interface Props {
  page: number
  /** Which side of the spread; the scroll line always sits on the edge facing the page */
  side: 'left' | 'right'
}

const props = defineProps<Props>()

const { verses, segments } = usePageTranslations(toRef(props, 'page'))

const caption = computed(() =>
  segments.value.map(s => `${s.surahNumber} · ${s.name} · อายะห์ ${s.from}–${s.to}`).join(' / '),
)

const scroller = ref<HTMLElement | null>(null)
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
})
</script>

<template>
  <aside :aria-label="`คำแปลหน้า ${page}`" class="@container flex min-w-[236px] max-w-[460px] flex-[1_1_236px] flex-col">
    <div class="relative min-h-0 flex-1">
      <div
        ref="scroller"
        :dir="side === 'right' ? 'rtl' : 'ltr'"
        class="scrollbar-dot absolute inset-0 overflow-y-scroll px-[18px] pt-5 pb-[72px] [mask-image:linear-gradient(to_bottom,#000_calc(100%-88px),transparent_calc(100%-16px))]"
        @scroll.passive="updateScrollState"
      >
        <!-- Pages 1–2 are centred short pages, so their translation sits centred beside them -->
        <div dir="ltr" :class="page <= 2 ? 'flex min-h-full flex-col justify-center' : ''">
          <MushafPageTranslationVerses :verses="verses" size="column" />
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-0.5 pt-2 pr-3 pb-3.5 pl-[18px]">
      <button
        type="button"
        :class="{ invisible: !canScrollMore }"
        class="flex h-9 cursor-pointer items-center gap-1.5 self-start pr-2.5 text-sm font-semibold text-ink"
        @click="scrollDown"
      >
        อ่านต่อ
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <span class="min-h-4 text-xs tracking-[0.02em] text-ink-muted">{{ caption }}</span>
    </div>
  </aside>
</template>
