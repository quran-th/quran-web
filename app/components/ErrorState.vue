<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    actionLabel?: string;
  }>(),
  {
    title: "โหลดหน้านี้ไม่สำเร็จ",
    message: "ตรวจสอบอินเทอร์เน็ต แล้วลองอีกครั้ง",
    actionLabel: "ลองอีกครั้ง",
  },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div role="alert" class="flex max-w-sm flex-col items-center px-6 text-center">
    <svg
      aria-hidden="true"
      viewBox="10 22 180 144"
      class="h-auto w-48"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="100" cy="156" rx="78" ry="6" class="fill-paper-tray/60" />

      <g transform="translate(0 20)">
        <path d="M100 42 C84 34 52 32 22 38 L22 124 C52 118 84 120 100 128 Z" class="fill-sage-600" />
        <path d="M100 42 C116 34 148 32 178 38 L178 124 C148 118 116 120 100 128 Z" class="fill-sage-700" />

        <path
          d="M100 38 C84 30 54 28 28 34 L28 118 C54 112 84 114 100 122 Z"
          class="fill-paper-pill stroke-ink"
          stroke-width="2"
        />
        <path
          d="M100 38 C116 30 146 28 172 34 L172 118 C146 112 116 114 100 122 Z"
          class="fill-paper-pill stroke-ink"
          stroke-width="2"
        />
        <path d="M100 38 L100 122" class="stroke-ink/40" stroke-width="1.5" />

        <g class="stroke-paper-tray" stroke-width="3.5">
          <path d="M42 52 H86" />
          <path d="M42 64 H86" />
          <path d="M42 76 H80" />
          <path d="M42 88 H86" />
          <path d="M42 100 H70" />
        </g>
        <g class="stroke-paper-tray" stroke-width="3" stroke-dasharray="3 7">
          <path d="M114 52 H158" />
          <path d="M114 64 H158" />
          <path d="M114 76 H152" />
          <path d="M114 88 H158" />
          <path d="M114 100 H142" />
        </g>
      </g>

      <g class="error-state-drift">
        <g transform="translate(148 34) rotate(12)">
          <rect x="2" y="4" width="32" height="40" rx="3" class="fill-ink/15" />
          <rect width="32" height="40" rx="3" class="fill-paper-pill stroke-ink" stroke-width="2" />
          <path d="M7 9 H25 M7 15 H21" class="stroke-paper-tray" stroke-width="2.5" />
          <circle cx="16" cy="27" r="7" class="fill-[#b4593f]" />
          <path d="M16 23.5 V27.5" class="stroke-paper-pill" stroke-width="2" />
          <circle cx="16" cy="30.6" r="1.1" class="fill-paper-pill" />
        </g>
      </g>
    </svg>

    <h2 class="mt-5 text-base font-semibold text-ink">{{ title }}</h2>
    <p class="mt-1.5 text-sm leading-relaxed text-ink-muted">{{ message }}</p>

    <button
      type="button"
      class="mt-5 inline-flex h-10 items-center whitespace-nowrap gap-2 rounded-xl bg-sage-600 px-4 text-sm font-medium text-paper-pill shadow-sm transition-colors hover:bg-sage-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600"
      @click="emit('retry')"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
        <path d="M20 4v7h-7" />
      </svg>
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .error-state-drift {
    animation: error-state-drift 4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
}

@keyframes error-state-drift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(-2px, -4px) rotate(-3deg); }
}
</style>
