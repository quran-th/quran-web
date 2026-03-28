<script setup lang="ts">
import { watch, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useQuranStore } from "~/stores/quranStore";
import { useMushafStore } from "~/stores/mushafStore";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useFontSettingsStore } from "~/stores/fontSettingsStore";
import { useQcfFont } from "~/composables/useQcfFont";
import ReadingVerseRow from "~/components/reading/VerseRow.vue";

const quranStore = useQuranStore();
const mushafStore = useMushafStore();
const readerSettings = useReaderSettingsStore();
const fontSettings = useFontSettingsStore();

const { currentPageVerseKeys, windowWords } = storeToRefs(mushafStore);
const { verses, loading, error } = storeToRefs(quranStore);
const { selectedSourceId } = storeToRefs(readerSettings);
const { fontVersion } = storeToRefs(fontSettings);

// Ensure fonts are loaded based on window words from mushafStore
const { isFontLoaded } = useQcfFont(windowWords, fontVersion);

const fetchPageVerses = async () => {
  const keys = currentPageVerseKeys.value;
  if (keys && keys.length > 0) {
    const sourceId =
      selectedSourceId.value && selectedSourceId.value > 0
        ? selectedSourceId.value
        : undefined;
    await quranStore.fetchVersesByKeys(keys, sourceId);
  } else {
    // If no keys, empty the verses
    verses.value = [];
  }
};

onMounted(() => {
  fetchPageVerses();
});

watch([currentPageVerseKeys, selectedSourceId], () => {
  fetchPageVerses();
});

const getSurahName = (surahNumber: number) => {
  const surah = quranStore.surahs.find((s) => s.id === surahNumber);
  return surah ? surah.name_simple : "";
};

const getWordsForVerse = (surahNumber: number, verseNumber: number) => {
  // Use words from the mushafStore which already contains them
  return windowWords.value.filter(
    (w) => w.verse_key === `${surahNumber}:${verseNumber}`,
  );
};
</script>

<template>
  <div class="container mx-auto max-w-6xl px-4 py-8 space-y-6">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg width="60" height="60" viewBox="0 0 50 50">
        <g fill="none" stroke="#60A5FA" stroke-width="2">
          <path d="M15 10h15l5 5v20H15V10">
            <animate
              attributeName="stroke-dasharray"
              values="0,100;100,0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M30 10v5h5">
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M20 20h10M20 25h10M20 30h10">
            <animate
              attributeName="stroke-dasharray"
              values="0,60;60,0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      </svg>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="py-12 text-center text-red-600">
      {{ error }}
    </div>

    <!-- Translation Verses -->
    <div v-else class="space-y-6">
      <div v-if="verses.length === 0" class="py-12 text-center text-slate-500">
        กำลังประมวลผลคำแปล...
      </div>
      <ReadingVerseRow
        v-for="verse in verses"
        :key="`${verse.surahNumber}-${verse.verseNumber}`"
        :verse="verse"
        :surah-number="verse.surahNumber || 1"
        :surah-name="getSurahName(verse.surahNumber || 1)"
        :words="getWordsForVerse(verse.surahNumber || 1, verse.verseNumber)"
        :is-font-loaded="isFontLoaded"
        :source-id="selectedSourceId"
      />
    </div>
  </div>
</template>
