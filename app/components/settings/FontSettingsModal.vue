<script setup lang="ts">
/**
 * FontSettingsModal — centered modal for selecting Quran font style.
 *
 * Tabs: Uthmani / IndoPak / Tajweed
 * Each tab shows available font options within that category.
 * Font scale controls (increase/decrease) apply globally.
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFontSettingsStore } from '~/stores/fontSettingsStore'
import { QuranFont, type FontCategory, type QuranWord, getWordTextField } from '~/types/quran'
import { useQcfFont } from '~/composables/useQcfFont'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const fontSettings = useFontSettingsStore()
const { quranFont, fontScale, fontCategory, fontVersion, isQcf } = storeToRefs(fontSettings)

// Local active tab (defaults to current font's category)
const activeTab = ref<FontCategory>(fontCategory.value)

// Tab definitions
const tabs: { key: FontCategory; label: string }[] = [
  { key: 'uthmani', label: 'อุษมานีย์' },
  { key: 'indopak', label: 'มะญีด' },
  { key: 'tajweed', label: 'ตัจวีด' },
]

// Font options per category
const fontOptions: {
  key: QuranFont
  label: string
  description: string
  category: FontCategory
}[] = [
  {
    key: QuranFont.MadaniV2,
    label: 'King Fahd V2',
    description: 'ศูนย์กษัตริย์ฟาฮัดเพื่อการพิมพ์อัลกุรอาน ฉบับปรับปรุงปีฮิจเราะห์ 1423',
    category: 'uthmani',
  },
  {
    key: QuranFont.MadaniV1,
    label: 'King Fahd V1',
    description: 'ศูนย์กษัตริย์ฟาฮัดเพื่อการพิมพ์อัลกุรอาน ฉบับปีฮิจเราะห์ 1405',
    category: 'uthmani',
  },
  {
    key: QuranFont.QPCHafs,
    label: 'QPC Uthmani Hafs',
    description: 'ตัวอักษรอุษมานีย์ทางการจากศูนย์กษัตริย์ฟาฮัด ตามรูปแบบมุศฮัฟมะดีนะฮ์',
    category: 'uthmani',
  },
  {
    key: QuranFont.IndoPak,
    label: 'IndoPak Nastaleeq',
    description: 'กุรอานแบบอักษร IndoPak 15 บรรทัด',
    category: 'indopak',
  },
  {
    key: QuranFont.TajweedV4,
    label: 'Tajweed',
    description: 'ตัวอักษรเน้นสีตามตัจวีด',
    category: 'tajweed',
  },
]

const filteredOptions = computed(() =>
  fontOptions.filter(opt => opt.category === activeTab.value)
)

function selectFont(font: QuranFont) {
  fontSettings.setFont(font)
}

function selectTab(category: FontCategory) {
  activeTab.value = category
  const firstOption = fontOptions.find(opt => opt.category === category)
  if (firstOption) {
    selectFont(firstOption.key)
  }
}

/**
 * Al-Fatihah 1:2 word data — embedded for preview rendering.
 */
const PREVIEW_WORDS = [
  {
    id: 1,
    position: 1,
    char_type_name: 'word' as const,
    code_v1: '\uFB56',
    code_v2: '\uFC46',
    text_uthmani: '\u0671\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F',
    text_qpc_hafs: '\u0671\u0644\u06E1\u062D\u064E\u0645\u06E1\u062F\u064F',
    text_indopak: '\u0627\u064E\u0644\u06E1\u062D\u064E\u0645\u06E1\u062F\u064F',
    text: '\u0671\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F',
    page_number: 1,
    line_number: 3,
  },
  {
    id: 2,
    position: 2,
    char_type_name: 'word' as const,
    code_v1: '\uFB57',
    code_v2: '\uFC47',
    text_uthmani: '\u0644\u0650\u0644\u0651\u064E\u0647\u0650',
    text_qpc_hafs: '\u0644\u0650\u0644\u0651\u064E\u0647\u0650',
    text_indopak: '\u0644\u0650\u0644\u0651\u0670\u0647\u0650',
    text: '\u0644\u0650\u0644\u0651\u064E\u0647\u0650',
    page_number: 1,
    line_number: 3,
  },
  {
    id: 3,
    position: 3,
    char_type_name: 'word' as const,
    code_v1: '\uFB58',
    code_v2: '\uFC48',
    text_uthmani: '\u0631\u064E\u0628\u0651\u0650',
    text_qpc_hafs: '\u0631\u064E\u0628\u0651\u0650',
    text_indopak: '\u0631\u064E\u0628\u0651\u0650',
    text: '\u0631\u064E\u0628\u0651\u0650',
    page_number: 1,
    line_number: 3,
  },
  {
    id: 4,
    position: 4,
    char_type_name: 'word' as const,
    code_v1: '\uFB59',
    code_v2: '\uFC49',
    text_uthmani: '\u0671\u0644\u0652\u0639\u064E\u0640\u0670\u0644\u064E\u0645\u0650\u064A\u0646\u064E',
    text_qpc_hafs: '\u0671\u0644\u06E1\u0639\u064E\u0670\u0644\u064E\u0645\u0650\u064A\u0646\u064E',
    text_indopak: '\u0627\u0644\u06E1\u0639\u0670\u0644\u064E\u0645\u0650\u064A\u06E1\u0646\u064E\u0669\u200F',
    text: '\u0671\u0644\u0652\u0639\u064E\u0640\u0670\u0644\u064E\u0645\u0650\u064A\u0646\u064E',
    page_number: 1,
    line_number: 3,
  },
] satisfies QuranWord[]

const previewWordsRef = computed(() => PREVIEW_WORDS)

// Load QCF page-1 font for glyph preview
const { isFontLoaded: isPreviewFontLoaded, isFontLoading: isPreviewFontLoading } = useQcfFont(previewWordsRef, fontVersion)

// Computed to check if any preview font is currently loading
const isPreviewLoading = computed(() => {
  if (!isQcf.value) return false
  return isPreviewFontLoading(1)
})

function close() {
  emit('update:visible', false)
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="props.visible"
        class="modal-overlay"
        @click="handleOverlayClick"
        @keydown.esc="close"
      >
        <div class="modal-content" role="dialog" aria-modal="true" aria-label="Font Settings">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">ตั้งค่ารูปแบบตัวอักษร</h2>
            <button class="modal-close" title="Close" @click="close">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <!-- Preview -->
          <div class="preview-section">
            <!-- Loading spinner while QCF font is loading -->
            <div v-if="isQcf && isPreviewLoading" class="preview-spinner">
              <div class="spinner-circle" />
            </div>

            <!-- Actual preview when font is ready -->
            <template v-else>
              <div class="preview-text" dir="rtl">
                <template v-for="word in PREVIEW_WORDS" :key="word.id">
                  <QuranGlyphWord
                    v-if="isQcf"
                    :glyph-code="getWordTextField(word, quranFont)"
                    :page-number="word.page_number"
                    :font-version="fontVersion"
                    :is-font-loaded="isPreviewFontLoaded(word.page_number)"
                  />
                  <QuranTextWord
                    v-else
                    :text="getWordTextField(word, quranFont)"
                    :quran-font="quranFont"
                  />
                </template>
              </div>
              <span class="preview-label">อัลฟาติฮะห์ 1:2</span>
            </template>
          </div>

          <!-- Tabs -->
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="tab"
              :class="{ 'tab--active': activeTab === tab.key }"
              @click="selectTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Font options -->
          <div class="options">
            <button
              v-for="opt in filteredOptions"
              :key="opt.key"
              class="option"
              :class="{ 'option--selected': quranFont === opt.key }"
              @click="selectFont(opt.key)"
            >
              <div class="option-info">
                <span class="option-label">{{ opt.label }}</span>
                <span class="option-desc">{{ opt.description }}</span>
              </div>
              <div class="option-check">
                <!-- Loading spinner -->
                <div v-if="quranFont === opt.key && isPreviewLoading" class="loading-spinner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <!-- Checkmark when loaded and selected -->
                <div v-else-if="quranFont === opt.key">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          <!-- Font scale -->
          <div class="scale-section">
            <span class="scale-label">ขนาดอักษร</span>
            <div class="scale-controls">
              <button class="scale-btn" :disabled="fontScale <= 1" @click="fontSettings.decreaseFontScale()">−</button>
              <span class="scale-value">{{ fontScale }}</span>
              <button class="scale-btn" :disabled="fontScale >= 5" @click="fontSettings.increaseFontScale()">+</button>
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
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1.5rem;
  margin: 0 1rem 0.75rem;
  background: #fafbfc;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
}

.preview-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 4rem;
}

.spinner-circle {
  width: 24px;
  height: 24px;
  border: 2.5px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.preview-text {
  display: flex;
  justify-content: center;
  gap: 0.1em;
  font-size: 1.75rem;
  line-height: 2.2;
  color: #1e293b;
  text-align: center;
  transition: font-family 0.2s ease;
}

.preview-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0.03em;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 0 1.5rem;
  margin-bottom: 0.75rem;
}

.tab {
  flex: 1;
  padding: 0.5rem 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover { background: #f8fafc; color: #475569; }
.tab--active { background: #0ea5e9; color: white; }
.tab--active:hover { background: #0284c7; color: white; }

.options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 1rem;
}

.option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}

.option:hover { background: #f1f5f9; border-color: #e2e8f0; }
.option--selected { background: #eff6ff; border-color: #bfdbfe; }

.option-info { display: flex; flex-direction: column; gap: 2px; }
.option-label { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
.option-desc { font-size: 0.75rem; color: #94a3b8; }
.option-check { color: #0ea5e9; width: 24px; flex-shrink: 0; }

.loading-spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scale-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem 1.25rem;
  margin-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

.scale-label { font-size: 0.85rem; font-weight: 600; color: #475569; }
.scale-controls { display: flex; align-items: center; gap: 0.5rem; }

.scale-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #475569;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.scale-btn:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
.scale-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.scale-value { min-width: 24px; text-align: center; font-size: 0.9rem; font-weight: 600; color: #1e293b; }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-active .modal-content,
.modal-leave-active .modal-content { transition: transform 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-content,
.modal-leave-to .modal-content { transform: scale(0.95) translateY(8px); }
</style>
