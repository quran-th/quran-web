<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>()

const { t } = useI18n()

const inputRef = ref<HTMLInputElement | null>(null)

function focus() {
  inputRef.value?.focus()
}

defineExpose({ inputRef, focus })
</script>

<template>
  <div class="flex items-center gap-2.5 px-4 py-3 rounded-full border-[2.5px] border-slate-200 bg-white transition-all focus-within:border-sky-500 focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.12)]">
    <svg
      class="text-slate-400 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
    <input
      ref="inputRef"
      type="text"
      class="flex-1 border-none bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
      :value="props.modelValue"
      :placeholder="props.placeholder ?? t('surah_selector.search_placeholder')"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <button
      v-if="props.modelValue"
      class="flex items-center justify-center border-none bg-transparent text-slate-400 cursor-pointer p-1 rounded-full transition-all hover:text-slate-600 hover:bg-slate-100"
      @click="emit('update:modelValue', '')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>
</template>
