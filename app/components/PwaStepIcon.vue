<script setup lang="ts">
export type PwaStepIconName = 'share' | 'add' | 'menu' | 'install-phone' | 'install-desktop'

defineProps<{ name: PwaStepIconName }>()
</script>

<template>
  <span class="mx-0.5 inline-grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-slate-50 align-middle text-slate-700">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <template v-if="name === 'share'">
        <path d="M12 15V3" />
        <path d="M8 7l4-4 4 4" />
        <path d="M6 10H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1" />
      </template>
      <template v-else-if="name === 'add'">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </template>
      <template v-else-if="name === 'menu'">
        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
      </template>
      <template v-else-if="name === 'install-phone'">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 7v7" />
        <path d="M9 11l3 3 3-3" />
      </template>
      <template v-else-if="name === 'install-desktop'">
        <path d="M21 12V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8" />
        <path d="M8 20h5" />
        <path d="M10.5 16v4" />
        <path d="M19 14v7" />
        <path d="M16 18l3 3 3-3" />
      </template>
    </svg>
  </span>
</template>
