<script setup lang="ts">
/**
 * SurahIndex — the spread's table of contents, set straight on the surround
 * beside the sheet. The open surah is highlighted and scrolled into view.
 */
import { nextTick, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useQuranStore } from "~/stores/quranStore";

const props = defineProps<{ currentSurah?: number }>();
const emit = defineEmits<{ select: [surah: number]; close: [] }>();

const quranStore = useQuranStore();
const { surahs } = storeToRefs(quranStore);
const list = ref<HTMLElement | null>(null);

function revealCurrent(behavior: ScrollBehavior) {
  const item = list.value?.querySelector<HTMLElement>('[aria-current="true"]');
  item?.scrollIntoView({ block: "center", behavior });
}

onMounted(async () => {
  if (surahs.value.length === 0) await quranStore.fetchSurahs();
  await nextTick();
  revealCurrent("instant");
});

watch(() => props.currentSurah, async () => {
  await nextTick();
  revealCurrent("smooth");
});
</script>

<template>
  <nav aria-label="สารบัญซูเราะฮ์" class="flex h-full flex-col text-ink">
    <div class="flex h-11 shrink-0 items-center justify-between pl-3">
      <span class="text-sm font-semibold text-ink-icon">สารบัญ</span>
      <button
        type="button"
        aria-label="ปิดสารบัญ"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-ink-icon hover:bg-paper-tint"
        @click="emit('close')"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </div>
    <ol ref="list" class="scrollbar-dot m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 pr-1 [mask-image:linear-gradient(to_bottom,transparent,#000_12px,#000_calc(100%-24px),transparent)]">
      <li v-for="surah in surahs" :key="surah.id">
        <button
          type="button"
          :aria-current="surah.id === currentSurah ? 'true' : undefined"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-paper-tint"
          :class="surah.id === currentSurah ? 'bg-paper-tint' : ''"
          @click="emit('select', surah.id)"
        >
          <span class="w-7 shrink-0 text-sm font-semibold tabular-nums text-sage-600">{{ surah.id }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[15px]" :class="surah.id === currentSurah ? 'font-semibold text-ink' : 'text-ink-soft'">{{ surah.name_thai }}</span>
            <span class="block text-xs text-ink-muted">{{ surah.verses_count }} อายะห์</span>
          </span>
          <span dir="rtl" lang="ar" class="shrink-0 font-arabic text-lg text-ink-icon">{{ surah.name_arabic }}</span>
        </button>
      </li>
    </ol>
  </nav>
</template>
