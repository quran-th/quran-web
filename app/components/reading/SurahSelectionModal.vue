<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useQuranStore } from "~/stores/quranStore";

const props = defineProps<{
  visible: boolean;
  currentSurahId?: number;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  select: [surahId: number];
}>();

const quranStore = useQuranStore();
const { surahs } = storeToRefs(quranStore);
const { t } = useI18n();

const searchQuery = ref("");
const scrollContainer = ref<HTMLDivElement | null>(null);
const searchBoxRef = ref<{ focus: () => void } | null>(null);

const { filteredSurahs } = useSurahSearch(surahs, searchQuery);

function close() {
  emit("update:visible", false);
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("modal-overlay")) {
    close();
  }
}

function selectSurah(surahId: number) {
  emit("select", surahId);
  close();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    close();
  } else if (e.key === "Enter" && filteredSurahs.value.length > 0) {
    selectSurah(filteredSurahs.value[0]!.id);
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      searchQuery.value = "";
      if (surahs.value.length === 0) {
        await quranStore.fetchSurahs();
      }
      await nextTick();
      searchBoxRef.value?.focus();

      if (props.currentSurahId && !searchQuery.value) {
        await nextTick();
        const activeEl = scrollContainer.value?.querySelector(
          `[data-surah-id="${props.currentSurahId}"]`,
        );
        activeEl?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="props.visible"
        class="modal-overlay"
        @click="handleOverlayClick"
        @keydown="handleKeydown"
      >
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          :aria-label="t('surah_selector.title')"
        >
          <ReadingSurahSearchBox
            ref="searchBoxRef"
            v-model="searchQuery"
            class="search-box-wrapper"
          />

          <!-- Search hints / results count -->
          <div class="results-info">
            <template v-if="searchQuery">
              {{ t('surah_selector.results_count_for', { count: filteredSurahs.length }) }} <span class="font-semibold">{{ searchQuery }}</span>
            </template>
            <template v-else>
              {{ t('surah_selector.search_hint') }}
            </template>
          </div>

          <!-- Surah card list -->
          <div ref="scrollContainer" class="surah-list">
            <div v-if="filteredSurahs.length === 0" class="empty-state">
              {{ t('surah_selector.empty') }}
            </div>
            <div class="surah-grid">
              <button
                v-for="surah in filteredSurahs"
                :key="surah.id"
                :data-surah-id="surah.id"
                class="surah-card"
                :class="{
                  'surah-card--active': surah.id === currentSurahId,
                }"
                @click="selectSurah(surah.id)"
              >
                <div class="surah-card-left">
                  <div class="surah-number">
                    {{ surah.id }}
                  </div>
                  <div class="surah-info">
                    <span class="surah-name-thai">{{ surah.name_thai }}</span>
                    <span class="surah-name-meaning">{{ surah.name_meaning_thai }}</span>
                  </div>
                </div>
                <div class="surah-card-right">
                  <span class="surah-name-arabic">{{ surah.name_arabic }}</span>
                  <span class="surah-meta">{{ surah.revelation_place === 'makkiyah' ? t('surah_selector.makkiyah') : t('surah_selector.madaniyah') }} · {{ t('surah_selector.ayah_count', { count: surah.verses_count }) }}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 92%;
  max-width: 620px;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.18),
    0 4px 20px rgba(0, 0, 0, 0.08);
}

/* Search box wrapper for modal margins */
.search-box-wrapper {
  margin: 1rem 1.25rem 0;
}

.results-info {
  padding: 0.5rem 1.5rem 0;
  font-size: 0.75rem;
  color: #94a3b8;
  flex-shrink: 0;
}

.surah-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1rem 1rem;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.surah-list::-webkit-scrollbar {
  width: 5px;
}

.surah-list::-webkit-scrollbar-track {
  background: transparent;
}

.surah-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}

.surah-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

@media (min-width: 640px) {
  .surah-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.surah-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.surah-card:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.surah-card--active {
  background: #eff6ff;
  border-color: #93c5fd;
}

.surah-card--active:hover {
  background: #dbeafe;
  border-color: #60a5fa;
}

.surah-card-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.surah-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  flex-shrink: 0;
  transition: all 0.15s;
}

.surah-card:hover .surah-number {
  background: #e2e8f0;
}

.surah-card--active .surah-number {
  background: #bfdbfe;
  color: #1d4ed8;
}

.surah-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.surah-name-thai {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
}

.surah-name-meaning {
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.3;
}

.surah-card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.surah-name-arabic {
  font-size: 1rem;
  color: #334155;
  direction: rtl;
  line-height: 1.4;
}

.surah-meta {
  font-size: 0.65rem;
  color: #94a3b8;
  text-transform: capitalize;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.96) translateY(12px);
}
</style>
