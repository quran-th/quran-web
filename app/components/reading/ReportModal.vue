<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useFingerprint } from "~/composables/useFingerprint";
import {
  type FootnoteMarker,
  insertFootnoteMarker,
  useFootnoteValidation,
  renumberFootnotesInOrder,
} from "~/composables/useFootnoteMarkers";
import { useDiff } from "~/composables/useDiff";

interface TurnstileInstance {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance;
  }
}

interface VerseFootnote {
  number: number;
  text: string;
}

interface Verse {
  verseNumber: number;
  content: string;
  translation: string;
  footnotes?: VerseFootnote[];
}

interface Props {
  visible: boolean;
  verse: Verse;
  surahNumber: number;
  surahName?: string;
  sourceId?: number;
}

type ReportCategory =
  | "typo"
  | "missing_words"
  | "wrong_translation"
  | "footnote_issue";

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:visible": [value: boolean];
  submitted: [];
}>();

const { t } = useI18n();
const { getFingerprint } = useFingerprint();
const config = useRuntimeConfig();

// State
const activeTab = ref<"quick" | "suggest">("quick");
const selectedCategories = ref<Set<ReportCategory>>(new Set());
const proposalText = ref("");
const footnotes = ref<FootnoteMarker[]>([]);
const contactName = ref("");
const submitting = ref(false);
const submitStatus = ref<"idle" | "success" | "error">("idle");
const submitError = ref("");
const textareaEl = ref<HTMLTextAreaElement | null>(null);
const isTextareaFocused = ref(false);

// Turnstile
const turnstileToken = ref("");
const turnstileWidgetId = ref<string | null>(null);
const turnstileContainerRef = ref<HTMLDivElement | null>(null);

// Diff preview
const currentTranslation = computed(() => props.verse.translation || "");
const { diffTokens } = useDiff(currentTranslation, proposalText);

// Footnote validation
const { validationErrors } = useFootnoteValidation(proposalText, footnotes);

// Category definitions
const categories: { key: ReportCategory; labelKey: string }[] = [
  { key: "typo", labelKey: "report.category_typo" },
  { key: "missing_words", labelKey: "report.category_missing_words" },
  {
    key: "wrong_translation",
    labelKey: "report.category_wrong_translation",
  },
  { key: "footnote_issue", labelKey: "report.category_footnote_issue" },
];

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (!turnstileToken.value) return false;

  if (activeTab.value === "quick") {
    return selectedCategories.value.size > 0;
  }

  if (activeTab.value === "suggest") {
    return (
      proposalText.value.trim().length > 0 &&
      proposalText.value.trim() !== currentTranslation.value.trim() &&
      validationErrors.value.length === 0
    );
  }

  return false;
});

function toggleCategory(cat: ReportCategory) {
  const updated = new Set(selectedCategories.value);
  if (updated.has(cat)) {
    updated.delete(cat);
  } else {
    updated.add(cat);
  }
  selectedCategories.value = updated;
}

function handleInsertFootnote() {
  insertFootnoteMarker(textareaEl, proposalText, footnotes);
}

function removeFootnote(index: number) {
  const fn = footnotes.value[index]!;
  const markerRe = new RegExp(`\\(\\*${fn.footnoteNumber}\\*\\)`, "g");
  proposalText.value = proposalText.value.replace(markerRe, "");
  footnotes.value = footnotes.value.filter((_, i) => i !== index);
  const result = renumberFootnotesInOrder(
    proposalText.value,
    footnotes.value,
  );
  if (result.changed) {
    proposalText.value = result.text;
    footnotes.value = result.footnotes;
  }
}

function resetForm() {
  selectedCategories.value = new Set();
  proposalText.value = props.verse.translation || "";
  footnotes.value = (props.verse.footnotes || []).map((fn) => ({
    footnoteNumber: fn.number,
    text: fn.text,
  }));
  contactName.value = "";
  submitStatus.value = "idle";
  submitError.value = "";
  turnstileToken.value = "";
  resetTurnstile();
}

function close() {
  emit("update:visible", false);
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("modal-overlay")) {
    close();
  }
}

// Initialize Turnstile widget
function renderTurnstile() {
  if (!turnstileContainerRef.value) return;
  if (typeof window === "undefined") return;

  const turnstile = window.turnstile;
  if (!turnstile) return;

  if (turnstileWidgetId.value) {
    turnstile.remove(turnstileWidgetId.value);
  }

  turnstileWidgetId.value = turnstile.render(turnstileContainerRef.value, {
    sitekey: config.public.turnstileSiteKey,
    callback: (token: string) => {
      turnstileToken.value = token;
    },
    "expired-callback": () => {
      turnstileToken.value = "";
    },
    theme: "light",
    size: "compact",
  });
}

function resetTurnstile() {
  const turnstile = window.turnstile;
  if (turnstile && turnstileWidgetId.value) {
    turnstile.reset(turnstileWidgetId.value);
  }
  turnstileToken.value = "";
}

// Load Turnstile script
function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[src*="turnstile"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

// Watch visibility to reset form and render turnstile
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      resetForm();
      await loadTurnstileScript();
      setTimeout(renderTurnstile, 100);
    } else {
      const turnstile = window.turnstile;
      if (turnstile && turnstileWidgetId.value) {
        turnstile.remove(turnstileWidgetId.value);
        turnstileWidgetId.value = null;
      }
    }
  },
);

async function handleSubmit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  submitStatus.value = "idle";
  submitError.value = "";

  try {
    const fingerprint = await getFingerprint();

    const payload: Record<string, unknown> = {
      surahNumber: props.surahNumber,
      verseNumber: props.verse.verseNumber,
      fingerprint,
      turnstileToken: turnstileToken.value,
      reportType: activeTab.value === "quick" ? "quick" : "detailed",
    };

    if (props.sourceId) {
      payload.sourceId = props.sourceId;
    }

    if (activeTab.value === "quick") {
      payload.categories = Array.from(selectedCategories.value);
    } else {
      payload.suggestedText = proposalText.value.trim();
      if (footnotes.value.length > 0) {
        payload.suggestedFootnotes = footnotes.value.map((fn) => ({
          footnoteNumber: fn.footnoteNumber,
          text: fn.text,
        }));
      }
    }

    if (contactName.value.trim()) {
      payload.contactName = contactName.value.trim();
    }

    const res = await $fetch<{ success: boolean; data: { id: number } }>(
      "/api/reports",
      {
        method: "POST",
        body: payload,
      },
    );

    if (res.success) {
      submitStatus.value = "success";
      emit("submitted");
      setTimeout(() => {
        close();
      }, 2000);
    } else {
      submitStatus.value = "error";
      submitError.value = t("report.error");
    }
  } catch (e: unknown) {
    submitStatus.value = "error";
    const err = e as { data?: { message?: string } };
    if (err?.data?.message?.includes("verification")) {
      submitError.value = t("report.turnstile_failed");
    } else {
      submitError.value = t("report.error");
    }
  } finally {
    submitting.value = false;
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
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          :aria-label="t('report.title')"
        >
          <!-- Header -->
          <div class="modal-header">
            <div>
              <h2 class="modal-title">{{ t("report.title") }}</h2>
              <p class="modal-subtitle">
                {{ props.surahName || "" }}
                {{ props.surahNumber }}:{{ props.verse.verseNumber }}
              </p>
            </div>
            <button class="modal-close" :title="t('common.back')" @click="close">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
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

          <!-- Tabs -->
          <div class="tabs">
            <button
              class="tab"
              :class="{ 'tab--active': activeTab === 'quick' }"
              @click="activeTab = 'quick'"
            >
              {{ t("report.tab_quick") }}
            </button>
            <button
              class="tab"
              :class="{ 'tab--active': activeTab === 'suggest' }"
              @click="activeTab = 'suggest'"
            >
              {{ t("report.tab_suggest") }}
            </button>
          </div>

          <!-- Quick Report Tab -->
          <div v-if="activeTab === 'quick'" class="tab-content">
            <p class="tab-description">{{ t("report.quick_description") }}</p>
            <div class="categories">
              <label
                v-for="cat in categories"
                :key="cat.key"
                class="category-item"
                :class="{ 'category-item--selected': selectedCategories.has(cat.key) }"
              >
                <input
                  type="checkbox"
                  :checked="selectedCategories.has(cat.key)"
                  class="category-checkbox"
                  @change="toggleCategory(cat.key)"
                >
                <span class="category-label">{{ t(cat.labelKey) }}</span>
              </label>
            </div>
          </div>

          <!-- Suggest Edit Tab -->
          <div v-if="activeTab === 'suggest'" class="tab-content">
            <p class="tab-description">{{ t("report.suggest_description") }}</p>

            <!-- Textarea with footnote toolbar -->
            <div class="textarea-wrapper">
              <textarea
                ref="textareaEl"
                v-model="proposalText"
                class="proposal-textarea"
                :placeholder="t('report.suggest_placeholder')"
                rows="5"
                @focus="isTextareaFocused = true"
                @blur="isTextareaFocused = false"
              />
              <div class="textarea-toolbar">
                <button
                  class="footnote-btn"
                  :disabled="!isTextareaFocused"
                  :title="t('report.footnote_add')"
                  @mousedown.prevent="handleInsertFootnote"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  {{ t("report.footnote_add") }}
                </button>
                <span class="char-count">
                  {{ t("report.char_count", { n: proposalText.length }) }}
                </span>
              </div>
            </div>

            <!-- Footnotes -->
            <div v-if="footnotes.length > 0" class="footnotes-section">
              <div
                v-for="(fn, idx) in footnotes"
                :key="fn.footnoteNumber"
                class="footnote-row"
              >
                <span class="footnote-number">(*{{ fn.footnoteNumber }}*)</span>
                <input
                  v-model="fn.text"
                  type="text"
                  class="footnote-input"
                  :placeholder="t('report.footnote_placeholder')"
                >
                <button
                  class="footnote-remove"
                  :title="t('report.footnote_remove')"
                  @click="removeFootnote(idx)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
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
            </div>

            <!-- Validation errors -->
            <div v-if="validationErrors.length > 0" class="validation-errors">
              <p v-for="err in validationErrors" :key="err" class="validation-error">
                {{ err }}
              </p>
            </div>

            <!-- Diff preview -->
            <div v-if="diffTokens.length > 0" class="diff-section">
              <h4 class="diff-title">{{ t("report.diff_title") }}</h4>
              <div class="diff-preview">
                <span
                  v-for="(token, i) in diffTokens"
                  :key="i"
                  :class="{
                    'diff-insert': token.type === 'insert',
                    'diff-delete': token.type === 'delete',
                  }"
                >{{ token.text }}</span>
              </div>
            </div>
          </div>

          <!-- Name field (both modes) -->
          <div class="name-field">
            <label class="name-label" for="report-name">
              {{ t("report.name_label") }}
            </label>
            <input
              id="report-name"
              v-model="contactName"
              type="text"
              class="name-input"
              :placeholder="t('report.name_placeholder')"
            >
          </div>

          <!-- Turnstile widget -->
          <div class="turnstile-wrapper">
            <div ref="turnstileContainerRef" />
          </div>

          <!-- Success/Error messages -->
          <div v-if="submitStatus === 'success'" class="status-message status-success">
            {{ t("report.success") }}
          </div>
          <div v-if="submitStatus === 'error'" class="status-message status-error">
            {{ submitError || t("report.error") }}
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-cancel" @click="close">
              {{ t("common.back") }}
            </button>
            <button
              class="btn-submit"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              {{ submitting ? t("report.submitting") : t("report.submit") }}
            </button>
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
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.08);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.modal-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 0.25rem 0 0;
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
  flex-shrink: 0;
}

.modal-close:hover {
  background: #f1f5f9;
  color: #475569;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 0 1.5rem;
  margin-bottom: 0.5rem;
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

.tab:hover {
  background: #f8fafc;
  color: #475569;
}

.tab--active {
  background: #0ea5e9;
  color: white;
}

.tab--active:hover {
  background: #0284c7;
  color: white;
}

.tab-content {
  padding: 0.75rem 1.5rem;
}

.tab-description {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0 0 0.75rem;
}

.categories {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.category-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.category-item--selected {
  background: #eff6ff;
  border-color: #93c5fd;
}

.category-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #0ea5e9;
  cursor: pointer;
  flex-shrink: 0;
}

.category-label {
  font-size: 0.9rem;
  color: #334155;
}

.textarea-wrapper {
  position: relative;
}

.proposal-textarea {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9rem;
  font-family: inherit;
  color: #1e293b;
  resize: vertical;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.proposal-textarea:focus {
  outline: none;
  border-color: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1);
}

.textarea-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.footnote-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #475569;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.footnote-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.footnote-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.char-count {
  font-size: 0.7rem;
  color: #94a3b8;
}

.footnotes-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 0.5rem;
}

.footnote-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footnote-number {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  min-width: 36px;
}

.footnote-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #1e293b;
}

.footnote-input:focus {
  outline: none;
  border-color: #0ea5e9;
}

.footnote-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.footnote-remove:hover {
  background: #fee2e2;
  color: #ef4444;
}

.validation-errors {
  margin-top: 0.5rem;
}

.validation-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin: 2px 0;
}

.diff-section {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #fafbfc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
}

.diff-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.diff-preview {
  font-size: 0.85rem;
  line-height: 1.6;
  color: #334155;
  word-break: break-word;
}

.diff-insert {
  background: #dcfce7;
  color: #166534;
  text-decoration: none;
}

.diff-delete {
  background: #fee2e2;
  color: #991b1b;
  text-decoration: line-through;
}

.name-field {
  padding: 0.5rem 1.5rem;
}

.name-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 4px;
}

.name-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #1e293b;
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1);
}

.turnstile-wrapper {
  display: flex;
  justify-content: center;
  padding: 0.5rem 1.5rem;
}

.status-message {
  margin: 0.5rem 1.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.85rem;
  text-align: center;
}

.status-success {
  background: #dcfce7;
  color: #166534;
}

.status-error {
  background: #fee2e2;
  color: #991b1b;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0.75rem 1.5rem 1.25rem;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.btn-submit {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: #0ea5e9;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-submit:hover:not(:disabled) {
  background: #0284c7;
}

.btn-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

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
  transform: scale(0.95) translateY(8px);
}
</style>
