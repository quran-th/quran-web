<script setup lang="ts">
const ICONS = {
  more: { paths: [], dots: [[5, 12], [12, 12], [19, 12]] },
  moreVertical: { paths: [], dots: [[12, 5], [12, 12], [12, 19]] },
  share: { paths: ['M12 15V3', 'M8 7l4-4 4 4', 'M6 10H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1'] },
  plusSquare: { paths: ['M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z', 'M12 8v8', 'M8 12h8'] },
  chevronLeft: { paths: ['m15 18-6-6 6-6'] },
  chevronRight: { paths: ['m9 18 6-6-6-6'] },
  copy: { paths: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2'] },
  close: { paths: ['M18 6 6 18', 'M6 6l12 12'] },
  globe: { paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'] },
  download: { paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'] },
  check: { paths: ['M20 6 9 17l-5-5'] },
  zap: { paths: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'] },
  maximize: { paths: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'] },
  refresh: { paths: ['M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16', 'M16 16h5v5'] },
} satisfies Record<string, { paths: string[], dots?: number[][] }>

export type PwaIconName = keyof typeof ICONS

const props = defineProps<{ name: PwaIconName }>()
const icon = computed<{ paths: string[], dots?: number[][] }>(() => ICONS[props.name])
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      v-for="d in icon.paths"
      :key="d"
      :d="d"
    />
    <circle
      v-for="[cx, cy] in icon.dots ?? []"
      :key="`${cx}-${cy}`"
      :cx="cx"
      :cy="cy"
      r="1.6"
      fill="currentColor"
      stroke="none"
    />
  </svg>
</template>
