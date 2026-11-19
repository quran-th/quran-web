<script setup lang="ts">
/**
 * MushafFittedPage — one page of a spread inside its slot.
 *
 * From 768px up the page width follows its container's HEIGHT (cqh units), so a
 * slot narrower than that width would clip the page. The inner container is
 * given an explicit height of min(slotHeight, slotWidth / lineWidthCqh) so the
 * whole page always fits the slot.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'

interface Props {
  pageNumber: number
  isFontLoaded: (pageNumber: number) => boolean
}

defineProps<Props>()

const { quranFont, fontScale } = storeToRefs(useFontSettingsStore())

const slot = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const fittedHeight = ref(0)
const maxSlotWidth = ref(0)
const SLOT_BREATHING_ROOM = 24

function fit() {
  const slotEl = slot.value
  const pageEl = container.value?.querySelector<HTMLElement>('.mushaf-page')
  if (!slotEl || !pageEl) return
  const lineWidthCqh = parseFloat(getComputedStyle(pageEl).getPropertyValue('--mushaf-line-width'))
  if (!lineWidthCqh) return
  const style = getComputedStyle(slotEl)
  const innerHeight = slotEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  fittedHeight.value = Math.floor(Math.min(innerHeight, (slotEl.clientWidth * 100) / lineWidthCqh))
  // Pages claim their full-height width first; only the width left over goes to the translation columns
  maxSlotWidth.value = Math.ceil((innerHeight * lineWidthCqh) / 100) + SLOT_BREATHING_ROOM
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!slot.value) return
  resizeObserver = new ResizeObserver(fit)
  resizeObserver.observe(slot.value)
  fit()
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch([fontScale, quranFont], async () => {
  await nextTick()
  fit()
})
</script>

<template>
  <div
    ref="slot"
    class="flex min-w-0 items-center justify-center pt-7 pb-2"
    :style="{ flex: maxSlotWidth ? `0 1 ${maxSlotWidth}px` : '1 1 0' }"
  >
    <div
      ref="container"
      class="flex w-full flex-col [container-type:size]"
      :class="{ 'opacity-0': !fittedHeight }"
      :style="{ height: `${fittedHeight}px` }"
    >
      <MushafPageView :page-number="pageNumber" :is-font-loaded="isFontLoaded" compact />
    </div>
  </div>
</template>
