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
  <div class="search-box">
    <svg
      class="search-icon"
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
      class="search-input"
      :value="props.modelValue"
      :placeholder="props.placeholder ?? t('surah_selector.search_placeholder')"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <button
      v-if="props.modelValue"
      class="search-clear"
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

<style scoped>
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.75rem 1rem;
  border: 2.5px solid #e2e8f0;
  border-radius: 999px;
  background: white;
  transition: all 0.15s;
}

.search-box:focus-within {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.search-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #1e293b;
  outline: none;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.15s;
}

.search-clear:hover {
  color: #475569;
  background: #f1f5f9;
}
</style>
