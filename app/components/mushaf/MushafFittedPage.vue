<script setup lang="ts">
/**
 * MushafFittedPage — one page of a spread inside its slot.
 *
 * From 768px up the page width follows its container's HEIGHT (cqh units), so a
 * slot narrower than that width would clip the page. The inner container is
 * given an explicit height of min(slotHeight, slotWidth / lineWidthCqh) so the
 * whole page always fits the slot.
 *
 * `fill` is for a lone page with spare width (portrait tablet, pane hidden): the
 * glyphs grow toward the slot width and the lines close up to make room.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'

interface Props {
  pageNumber: number
  isFontLoaded: (pageNumber: number) => boolean
  fill?: boolean
}

const props = withDefaults(defineProps<Props>(), { fill: false })

const { fontScale } = storeToRefs(useFontSettingsStore())

const slot = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const fittedHeight = ref(0)
const maxSlotWidth = ref(0)
const fillVars = ref<Record<string, string> | null>(null)
const SLOT_BREATHING_ROOM = 24
// Tightest line pitch, as a multiple of the glyph size, before stacked marks crowd the next line
const MIN_LINE_PITCH = 1.6

/** The scale class's sizes in cqh, read before any fill override replaces them */
let scale: { font: number; line: number; width: number } | null = null

function readScale(pageEl: HTMLElement) {
  const style = getComputedStyle(pageEl)
  const cqh = (name: string) => parseFloat(style.getPropertyValue(name))
  const read = { font: cqh('--mushaf-font-size'), line: cqh('--mushaf-line-height'), width: cqh('--mushaf-line-width') }
  return read.font && read.line && read.width ? read : null
}

// The scale's line pitch stays as the height budget per line; the glyphs take
// whatever the width allows up to MIN_LINE_PITCH of that pitch
function growToWidth(width: number, height: number) {
  if (!scale) return null
  const pitch = (height * scale.line) / 100
  const font = Math.min((width * scale.font) / scale.width, pitch / MIN_LINE_PITCH)
  if (font <= (height * scale.font) / 100) return null
  return {
    '--mushaf-font-size': `${font}px`,
    '--mushaf-line-height': `${pitch}px`,
    '--mushaf-line-width': `${(font * scale.width) / scale.font}px`,
  }
}

function fit() {
  const slotEl = slot.value
  const pageEl = container.value?.querySelector<HTMLElement>('.mushaf-page')
  if (!slotEl || !pageEl) return
  scale ??= readScale(pageEl)
  if (!scale) return
  const style = getComputedStyle(slotEl)
  const innerHeight = slotEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  fittedHeight.value = Math.floor(Math.min(innerHeight, (slotEl.clientWidth * 100) / scale.width))
  // Pages claim their full-height width first; only the width left over goes to the translation columns
  maxSlotWidth.value = Math.ceil((innerHeight * scale.width) / 100) + SLOT_BREATHING_ROOM
  fillVars.value = props.fill ? growToWidth(slotEl.clientWidth - SLOT_BREATHING_ROOM, innerHeight) : null
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!slot.value) return
  resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(slot.value)
  fit()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(fontScale, async () => {
  scale = null
  fillVars.value = null
  await nextTick()
  fit()
})

watch(() => props.fill, async () => {
  await nextTick()
  fit()
})
</script>

<template>
  <div
    ref="slot"
    class="flex min-w-0 items-center justify-center pt-7 pb-2"
    :style="{ flex: fill ? '1 1 0' : maxSlotWidth ? `0 1 ${maxSlotWidth}px` : '1 1 0' }"
  >
    <div
      ref="container"
      class="flex w-full flex-col [container-type:size]"
      :class="{ 'opacity-0': !fittedHeight }"
      :style="{ height: `${fittedHeight}px` }"
    >
      <MushafPageView :page-number="pageNumber" :is-font-loaded="isFontLoaded" :style="fillVars ?? undefined" compact />
    </div>
  </div>
</template>
