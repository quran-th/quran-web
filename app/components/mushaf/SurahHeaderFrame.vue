<script setup lang="ts">
/**
 * SurahHeaderFrame — the printed-Mushaf surah title cartouche, drawn as vectors.
 *
 * Three parts so it stretches cleanly: two fixed-aspect end caps carrying the
 * interlaced knot, and a middle run of the double rule that stretches to any
 * width. The right cap is the left one mirrored.
 */
</script>

<template>
  <div class="surah-frame relative flex w-full items-stretch" dir="ltr">
    <svg
      v-for="side in ['left', 'right']"
      :key="side"
      aria-hidden="true"
      viewBox="0 0 120 60"
      class="aspect-[2/1] h-full w-auto shrink-0"
      :class="side === 'right' ? 'order-3 -scale-x-100' : 'order-1'"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M120 2H7Q2 2 2 7V53Q2 58 7 58H120Z" class="surah-frame-fill" stroke="none" />
      <path d="M120 2H7Q2 2 2 7V53Q2 58 7 58H120" stroke-width="1.6" />
      <path d="M120 6.5H10Q6.5 6.5 6.5 10V50Q6.5 53.5 10 53.5H120" stroke-width="0.9" />

      <!-- Brace that closes the knot panel off from the title -->
      <path d="M112 6.5C99 6.5 102 22 90 30C102 38 99 53.5 112 53.5" stroke-width="1.1" />

      <!-- Interlaced knot: centre lozenge, two side lobes, sweeping top and bottom arcs -->
      <path d="M48 17 61 30 48 43 35 30Z" stroke-width="1.1" />
      <path d="M35 30C28 15 12 15 12 30S28 45 35 30" stroke-width="1.1" />
      <path d="M61 30C68 15 84 15 84 30S68 45 61 30" stroke-width="1.1" />
      <path d="M48 17C42 9.5 26 9 15 11.5M48 17C54 9.5 70 9 86 12" stroke-width="1.1" />
      <path d="M48 43C42 50.5 26 51 15 48.5M48 43C54 50.5 70 51 86 48" stroke-width="1.1" />
      <path d="M6.5 19Q13 19 13 11M6.5 41Q13 41 13 49" stroke-width="0.9" />
      <g fill="currentColor" stroke="none">
        <circle cx="48" cy="24" r="1.7" />
        <circle cx="54" cy="30" r="1.7" />
        <circle cx="48" cy="36" r="1.7" />
        <circle cx="42" cy="30" r="1.7" />
        <circle cx="24" cy="30" r="1.5" />
        <circle cx="72" cy="30" r="1.5" />
      </g>
    </svg>

    <svg
      aria-hidden="true"
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      class="order-2 -mx-px h-full min-w-0 flex-1"
      fill="none"
      stroke="currentColor"
    >
      <rect x="0" y="2" width="100" height="56" class="surah-frame-fill" stroke="none" />
      <path d="M0 2H100M0 58H100" stroke-width="1.6" />
      <path d="M0 6.5H100M0 53.5H100" stroke-width="0.9" />
    </svg>

    <div class="absolute inset-0 flex items-center justify-center text-ink-strong" dir="rtl">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Height follows the Mushaf font size so the cartouche scales with the page */
.surah-frame {
  height: calc(var(--mushaf-font-size, 5.3vw) * 1.75);
  color: #a3977a;
}

.surah-frame-fill {
  fill: rgba(255, 255, 255, 0.45);
}
</style>
