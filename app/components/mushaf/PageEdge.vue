<script setup lang="ts">
/**
 * The parent sizes the zone so its inner end sits just inside the paper; the
 * chevron rides that end, on the page edge itself.
 *
 * A click zone along one outer edge of the paper, for turning pages with a mouse.
 * The Mushaf reads right to left, so the left edge leads on and the right edge back.
 */
const props = defineProps<{ side: "left" | "right"; disabled?: boolean }>();
const emit = defineEmits<{ turn: [direction: "next" | "prev"] }>();

function handleClick() {
  if (!props.disabled) emit("turn", props.side === "left" ? "next" : "prev");
}
</script>

<template>
  <div
    aria-hidden="true"
    class="group absolute inset-y-0 z-20 hidden select-none mouse:block"
    :class="disabled ? 'pointer-events-none' : 'cursor-pointer'"
    :title="side === 'left' ? 'หน้าถัดไป' : 'หน้าก่อนหน้า'"
    @click="handleClick"
  >
    <div
      class="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
      :class="side === 'left'
        ? 'bg-linear-to-r from-[rgba(70,55,30,0.12)] to-transparent'
        : 'bg-linear-to-l from-[rgba(70,55,30,0.12)] to-transparent'"
    />
    <div
      class="absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper-pill text-ink-icon opacity-0 shadow-pill transition-[opacity,transform] duration-200 group-hover:opacity-100 motion-reduce:transition-none"
      :class="side === 'left'
        ? 'right-0 translate-x-1 group-hover:translate-x-0'
        : 'left-0 -translate-x-1 group-hover:translate-x-0'"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path :d="side === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'" />
      </svg>
    </div>
  </div>
</template>
