<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ text: string }>();

const SPEED_PX_PER_SEC = 30;

const boxRef = ref<HTMLElement | null>(null);
const textRef = ref<HTMLElement | null>(null);
const shift = ref(0);
const duration = ref(0);

function measure() {
  const box = boxRef.value;
  const text = textRef.value;
  if (!box || !text) return;
  const overflow = text.scrollWidth - box.clientWidth;
  shift.value = overflow > 1 ? overflow : 0;
  // Two pans plus a pause at each end, so the reader can finish the visible part
  duration.value = shift.value ? (shift.value / SPEED_PX_PER_SEC) * 2 + 3 : 0;
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (boxRef.value) observer.observe(boxRef.value);
});
onBeforeUnmount(() => observer?.disconnect());
watch(() => props.text, () => nextTick(measure));
</script>

<template>
  <div ref="boxRef" class="w-full overflow-hidden">
    <span
      ref="textRef"
      class="marquee-text inline-block whitespace-nowrap"
      :class="shift && 'is-sliding'"
      :style="shift ? { '--marquee-shift': `-${shift}px`, animationDuration: `${duration}s` } : undefined"
    >{{ text }}</span>
  </div>
</template>

<style scoped>
@keyframes marquee-slide {
  0%, 15% { transform: translateX(0); }
  50%, 65% { transform: translateX(var(--marquee-shift)); }
  100% { transform: translateX(0); }
}

@media (prefers-reduced-motion: no-preference) {
  .is-sliding {
    animation: marquee-slide linear infinite;
  }
}
</style>
