<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    options: { value: number; label: string }[];
    label: string;
    itemHeight?: number;
    visibleRows?: number;
  }>(),
  { itemHeight: 36, visibleRows: 5 },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const scroller = ref<HTMLElement | null>(null);
// Fractional index under the center line; drives the per-row fade/scale
const position = ref(0);
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let rafId = 0;

const selectedIndex = computed(() =>
  Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)),
);
const padding = computed(() => ((props.visibleRows - 1) / 2) * props.itemHeight);

function scrollToIndex(index: number, smooth = false) {
  scroller.value?.scrollTo({ top: index * props.itemHeight, behavior: smooth ? "smooth" : "auto" });
}

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      position.value = el.scrollTop / props.itemHeight;
    });
  }
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    const index = Math.min(props.options.length - 1, Math.max(0, Math.round(el.scrollTop / props.itemHeight)));
    const option = props.options[index];
    if (option && option.value !== props.modelValue) emit("update:modelValue", option.value);
  }, 100);
}

function onKeydown(e: KeyboardEvent) {
  const delta = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
  if (!delta) return;
  e.preventDefault();
  const next = props.options[selectedIndex.value + delta];
  if (next) emit("update:modelValue", next.value);
}

function rowStyle(i: number) {
  const distance = Math.abs(i - position.value);
  return {
    height: `${props.itemHeight}px`,
    opacity: Math.max(0.15, 1 - distance * 0.38),
    transform: `scale(${Math.max(0.78, 1 - distance * 0.1)})`,
  };
}

watch(selectedIndex, (i) => {
  const el = scroller.value;
  // Skip when the wheel itself caused the change
  if (el && Math.round(el.scrollTop / props.itemHeight) !== i) scrollToIndex(i, true);
});

onMounted(async () => {
  await nextTick();
  scrollToIndex(selectedIndex.value);
  position.value = selectedIndex.value;
});

onBeforeUnmount(() => {
  if (settleTimer) clearTimeout(settleTimer);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
  <div
    ref="scroller"
    role="listbox"
    tabindex="0"
    :aria-label="label"
    class="snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
    :style="{ height: `${itemHeight * visibleRows}px`, paddingBlock: `${padding}px` }"
    @scroll.passive="onScroll"
    @keydown="onKeydown"
  >
    <div
      v-for="(option, i) in options"
      :key="option.value"
      role="option"
      :aria-selected="option.value === modelValue"
      class="flex cursor-pointer snap-center items-center justify-center text-lg tabular-nums transition-colors"
      :class="option.value === modelValue ? 'font-medium text-slate-900' : 'text-slate-500'"
      :style="rowStyle(i)"
      @click="scrollToIndex(i, true)"
    >
      {{ option.label }}
    </div>
  </div>
</template>
