<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRecitationStore } from '~/stores/recitationStore'
import type { Verse } from '~/stores/quranStore'
import { splitFootnoteMarkers } from '~/composables/usePageTranslations'
import { useFootnotePopover } from '~/composables/useFootnotePopover'

interface Props {
  verses: Verse[]
  size: 'column' | 'sheet'
  highlightKey?: string
}

defineProps<Props>()

const { activeVerseKey, status } = storeToRefs(useRecitationStore())

const openReport = inject<(verse: Verse, categories?: string[]) => void>('openReport', () => {})

const { activeId } = useFootnotePopover()
const instanceId = useId()

const HOVER_OPEN_MS = 120
const HOVER_CLOSE_MS = 150
const EDGE = 8
const GAP = 6

interface OpenState {
  id: string
  verse: Verse
  number: number
  trigger: HTMLElement
}

const current = ref<OpenState | null>(null)
const popover = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })
const placed = ref(false)
let openedByHover = false
let restoringFocus = false
let openTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined

const footnoteText = computed(() => {
  const state = current.value
  if (!state) return ''
  return state.verse.footnotes?.find(f => f.number === state.number)?.text?.trim() ?? ''
})

// Inside the sheet the popover must stay within its focus trap; elsewhere it escapes the column's clipping scroller
const teleportTarget = computed<HTMLElement | string>(
  () => current.value?.trigger.closest<HTMLElement>('[role="dialog"]') ?? 'body',
)

function footnoteId(verse: Verse, number: number) {
  return `${instanceId}-${verse.surahNumber}:${verse.verseNumber}-${number}`
}

function clearTimers() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
}

function close() {
  clearTimers()
  if (current.value && activeId.value === current.value.id) activeId.value = null
  current.value = null
  placed.value = false
}

async function show(verse: Verse, number: number, trigger: HTMLElement, byHover: boolean) {
  clearTimers()
  const id = footnoteId(verse, number)
  if (current.value?.id === id) return
  openedByHover = byHover
  current.value = { id, verse, number, trigger }
  activeId.value = id
  placed.value = false
  await nextTick()
  place()
}

function place() {
  const state = current.value
  const el = popover.value
  if (!state || !el) return
  const anchor = state.trigger.getBoundingClientRect()
  const bounds = state.trigger.closest('aside, [role="dialog"]')?.getBoundingClientRect()
  const { offsetWidth: w, offsetHeight: h } = el
  const vw = window.innerWidth
  const vh = window.innerHeight

  let minX = EDGE
  let maxX = vw - w - EDGE
  if (bounds && bounds.width >= w + EDGE * 2) {
    minX = Math.max(minX, bounds.left + EDGE)
    maxX = Math.min(maxX, bounds.right - w - EDGE)
  }
  const left = Math.max(minX, Math.min(anchor.left + anchor.width / 2 - w / 2, maxX))

  const below = anchor.bottom + GAP
  const above = anchor.top - GAP - h
  const fitsBelow = below + h <= vh - EDGE
  const top = fitsBelow || above < EDGE ? Math.min(below, Math.max(EDGE, vh - h - EDGE)) : above

  position.value = { left, top }
  placed.value = true
}

function onPointerEnter(e: PointerEvent, verse: Verse, number: number) {
  if (e.pointerType !== 'mouse') return
  clearTimeout(closeTimer)
  clearTimeout(openTimer)
  const trigger = e.currentTarget as HTMLElement
  openTimer = setTimeout(() => show(verse, number, trigger, true), HOVER_OPEN_MS)
}

function cancelClose() {
  clearTimeout(closeTimer)
}

function scheduleClose(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  clearTimeout(openTimer)
  if (!current.value || !openedByHover) return
  clearTimeout(closeTimer)
  closeTimer = setTimeout(close, HOVER_CLOSE_MS)
}

function onFocus(e: FocusEvent, verse: Verse, number: number) {
  const trigger = e.currentTarget as HTMLElement
  // A mouse press focuses the button before click; click owns that toggle
  if (restoringFocus || !trigger.matches(':focus-visible')) return
  show(verse, number, trigger, false)
}

function onClick(e: MouseEvent, verse: Verse, number: number) {
  const trigger = e.currentTarget as HTMLElement
  clearTimers()
  if (current.value?.id === footnoteId(verse, number)) {
    if (openedByHover) openedByHover = false
    else close()
    return
  }
  show(verse, number, trigger, false)
}

function onDocumentPointerDown(e: PointerEvent) {
  const state = current.value
  if (!state) return
  const target = e.target as Node
  if (popover.value?.contains(target) || state.trigger.contains(target)) return
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !current.value) return
  e.stopPropagation()
  e.preventDefault()
  const trigger = current.value.trigger
  close()
  restoringFocus = true
  trigger.focus({ preventScroll: true })
  restoringFocus = false
}

function onReport() {
  const verse = current.value?.verse
  if (!verse) return
  close()
  openReport(verse, ['footnote_issue'])
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  close()
})

// Another instance (the other column) took over the single open popover
watch(activeId, (id) => {
  if (current.value && id !== current.value.id) {
    clearTimers()
    current.value = null
    placed.value = false
  }
})

watch(() => current.value?.trigger.isConnected, (connected) => {
  if (connected === false) close()
})
</script>

<template>
  <p
    v-for="verse in verses"
    :key="`${verse.surahNumber}:${verse.verseNumber}`"
    :data-verse-key="`${verse.surahNumber}:${verse.verseNumber}`"
    class="-mx-2 mb-1.5 rounded-lg px-2 py-1 font-reading text-ink-soft transition-colors"
    :class="[
      size === 'sheet' ? 'text-[15px] leading-[1.7]' : 'text-[13.5px] leading-[1.6] @min-[236px]:text-[14.5px] @min-[236px]:leading-[1.65] @min-[340px]:text-base @min-[340px]:leading-[1.75]',
      highlightKey === `${verse.surahNumber}:${verse.verseNumber}` ? 'bg-paper-wash' : '',
    ]"
  >
    <span
      class="mr-1.5 font-semibold tabular-nums"
      :class="status === 'playing' && activeVerseKey === `${verse.surahNumber}:${verse.verseNumber}`
        ? 'ayah-glow [--ayah-disc-h:1.5em] [--ayah-disc-w:calc(100%+0.75em)]'
        : 'text-sage-600'"
    >{{ verse.verseNumber }}</span>
    <template v-for="(part, i) in splitFootnoteMarkers(verse.translation || '')" :key="i">
      <button
        v-if="part.type === 'footnote'"
        type="button"
        :aria-label="`เชิงอรรถ ${verse.verseNumber}:${part.value}`"
        aria-haspopup="true"
        :aria-expanded="current?.id === footnoteId(verse, Number(part.value))"
        :aria-controls="current?.id === footnoteId(verse, Number(part.value)) ? `${current.id}-pop` : undefined"
        class="relative -top-[0.5em] mx-px inline cursor-pointer rounded-sm align-baseline text-[0.7em] leading-none font-semibold text-sage-600 hover:text-sage-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sage-500"
        @pointerenter="onPointerEnter($event, verse, Number(part.value))"
        @pointerleave="scheduleClose"
        @focus="onFocus($event, verse, Number(part.value))"
        @click="onClick($event, verse, Number(part.value))"
      >{{ part.value }}</button>
      <template v-else>{{ part.value }}</template>
    </template>
  </p>

  <Teleport v-if="current" :to="teleportTarget">
    <div
      :id="`${current.id}-pop`"
      ref="popover"
      role="dialog"
      :aria-label="`เชิงอรรถ ${current.verse.verseNumber}:${current.number}`"
      class="fixed z-[60] w-[min(320px,90vw)] rounded-[12px] bg-paper-pill p-3 text-left shadow-menu"
      :class="placed ? '' : 'invisible'"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      dir="ltr"
      @pointerenter="cancelClose"
      @pointerleave="scheduleClose"
      @touchstart.stop
      @touchend.stop
    >
      <div class="mb-1 text-xs text-ink-muted">เชิงอรรถ {{ current.verse.verseNumber }}:{{ current.number }}</div>
      <p v-if="footnoteText" class="font-reading text-[14px] leading-[1.65] whitespace-pre-line text-ink-soft">{{ footnoteText }}</p>
      <div v-else class="flex flex-col items-center gap-1 py-1 text-center">
        <svg aria-hidden="true" width="72" height="56" viewBox="0 0 72 56" fill="none" stroke-linecap="round" stroke-linejoin="round" class="text-ink-muted">
          <path d="M8 12c8-3 16-3 24 2v30c-8-5-16-5-24-2V12Z" stroke="currentColor" stroke-width="1.5" />
          <path d="M32 14c8-5 16-5 24-2v30c-8-3-16-3-24 2V14Z" stroke="currentColor" stroke-width="1.5" />
          <path d="M13 22c4-1 8-1 14 1M13 29c4-1 8-1 14 1" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
          <path d="M37 24c4-1.5 8-1.5 11-.5M37 31c3-1 6-1 8-.5" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
          <path d="M13 38h14" stroke="var(--color-sage-600)" stroke-width="1.8" stroke-dasharray="1 4" />
          <circle cx="56" cy="14" r="9" fill="var(--color-paper-pill)" stroke="var(--color-sage-600)" stroke-width="1.5" />
          <path d="M53.5 12.2a2.7 2.7 0 1 1 3.6 2.5c-.7.3-1.1.8-1.1 1.6" stroke="var(--color-sage-600)" stroke-width="1.5" />
          <circle cx="56" cy="19" r="0.6" fill="var(--color-sage-600)" stroke="var(--color-sage-600)" stroke-width="1" />
        </svg>
        <p class="text-[14px] text-ink-soft">ยังไม่มีข้อความเชิงอรรถนี้</p>
        <p class="text-xs text-ink-muted">ช่วยแจ้งให้เราทราบเพื่อเพิ่มเติม</p>
        <button
          type="button"
          class="mt-2 h-9 cursor-pointer rounded-xl bg-sage-600 px-3 text-sm text-white hover:bg-sage-700"
          @click="onReport"
        >แจ้งเชิงอรรถที่ขาดหาย</button>
      </div>
    </div>
  </Teleport>
</template>
