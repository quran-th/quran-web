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
  | "footnote_issue"
  | "audio_issue";

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:visible": [value: boolean];
  submitted: [];
}>();

const { t } = useI18n();
const { getFingerprint } = useFingerprint();
const config = useRuntimeConfig();

// State
const selectedCategories = ref<Set<ReportCategory>>(new Set());
const showSuggestEdit = ref(false);
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
const verified = computed(() => !!turnstileToken.value);

// Diff preview
const currentTranslation = computed(() => props.verse.translation || "");
const { diffTokens } = useDiff(currentTranslation, proposalText);

// Footnote validation
const { validationErrors } = useFootnoteValidation(proposalText, footnotes);

// Category definitions
// icon: SVG path data on a 24×24 stroked grid
const categories: { key: ReportCategory; labelKey: string; icon: string[] }[] = [
  { key: "typo", labelKey: "report.category_typo", icon: ["m6 16 6-12 6 12", "M8 12h8", "m16 20 2 2 4-4"] },
  { key: "missing_words", labelKey: "report.category_missing_words", icon: ["M3 6h18", "M3 12h6", "M15 12h6", "M3 18h12"] },
  {
    key: "wrong_translation",
    labelKey: "report.category_wrong_translation",
    icon: ["m5 8 6 6", "m4 14 6-6 2-3", "M2 5h12", "M7 2h1", "m22 22-5-10-5 10", "M14 18h6"],
  },
  {
    key: "footnote_issue",
    labelKey: "report.category_footnote_issue",
    icon: [
      "m4 19 8-8",
      "m12 19-8-8",
      "M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06",
    ],
  },
  { key: "audio_issue", labelKey: "report.category_audio_issue", icon: ["M11 5 6 9H2v6h4l5 4V5z", "m22 9-6 6", "m16 9 6 6"] },
];

const hasSuggestion = computed(() => {
  const text = proposalText.value.trim();
  return text.length > 0 && text !== currentTranslation.value.trim();
});

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (!turnstileToken.value) return false;

  const hasCategories = selectedCategories.value.size > 0;
  const hasValidSuggestion = hasSuggestion.value && validationErrors.value.length === 0;

  return hasCategories || hasValidSuggestion;
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

function expandFootnote(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function collapseFootnote(el: HTMLTextAreaElement) {
  el.style.height = "";
  el.scrollTop = 0;
}

function autoResizeFootnote(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
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
  showSuggestEdit.value = false;
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
    script.onerror = () => resolve();
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
  { immediate: true },
);

async function handleSubmit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  submitStatus.value = "idle";
  submitError.value = "";

  try {
    const fingerprint = await getFingerprint();

    const isDetailed = hasSuggestion.value;
    const payload: Record<string, unknown> = {
      surahNumber: props.surahNumber,
      verseNumber: props.verse.verseNumber,
      fingerprint,
      turnstileToken: turnstileToken.value,
      reportType: isDetailed ? "detailed" : "quick",
    };

    if (props.sourceId) {
      payload.sourceId = props.sourceId;
    }

    if (selectedCategories.value.size > 0) {
      payload.categories = Array.from(selectedCategories.value);
    }

    if (isDetailed) {
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

          <!-- Step 1: Turnstile verification -->
          <div v-if="!verified" class="verification-screen">
            <p class="verification-hint">{{ t("report.verify_hint") }}</p>
            <div class="turnstile-wrapper">
              <div ref="turnstileContainerRef" />
            </div>
          </div>

          <!-- Step 2: Success screen -->
          <div v-else-if="submitStatus === 'success'" class="success-screen">
            <div class="success-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p class="success-text">{{ t("report.success") }}</p>
            <button class="btn-success-close" @click="close">
              {{ t("common.back") }}
            </button>
          </div>

          <!-- Step 3: Form -->
          <template v-else>
            <div class="modal-body">
              <div class="section">
                <div class="flex flex-wrap justify-center gap-2">
                  <label
                    v-for="cat in categories"
                    :key="cat.key"
                    class="relative flex basis-[calc((100%-1rem)/3)] cursor-pointer select-none flex-col items-center gap-1.5 rounded-xl border px-1.5 pb-2.5 pt-3 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400"
                    :class="selectedCategories.has(cat.key)
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedCategories.has(cat.key)"
                      class="sr-only"
                      @change="toggleCategory(cat.key)"
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path v-for="d in cat.icon" :key="d" :d="d" />
                    </svg>
                    <span
                      class="whitespace-pre-line text-xs leading-snug"
                      :class="selectedCategories.has(cat.key) ? 'font-medium text-brand-800' : 'text-slate-700'"
                    >{{ t(cat.labelKey) }}</span>
                    <span
                      v-if="selectedCategories.has(cat.key)"
                      class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-500 text-white"
                      aria-hidden="true"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  </label>
                </div>
              </div>

              <!-- Suggest edit toggle -->
              <div class="section">
                <button class="suggest-toggle" @click="showSuggestEdit = !showSuggestEdit">
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
                    class="toggle-icon"
                    :class="{ 'toggle-icon--open': showSuggestEdit }"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  {{ t("report.suggest_prompt") }}
                </button>

                <!-- Edit form (collapsible) -->
                <Transition name="collapse">
                  <div v-if="showSuggestEdit" class="suggest-content">
                    <div class="section-hint">{{ t("report.suggest_description") }}</div>

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
                        <textarea
                          v-model="fn.text"
                          class="footnote-input"
                          :placeholder="t('report.footnote_placeholder')"
                          rows="1"
                          @focus="(e) => expandFootnote(e.target as HTMLTextAreaElement)"
                          @blur="(e) => collapseFootnote(e.target as HTMLTextAreaElement)"
                          @input="(e) => autoResizeFootnote(e.target as HTMLTextAreaElement)"
                        />
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
                      <div class="diff-preview text-reading">
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
                </Transition>
              </div>

              <!-- Name field (always visible) -->
              <div class="name-field section">
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

              <!-- Error message -->
              <div v-if="submitStatus === 'error'" class="status-message status-error">
                {{ submitError || t("report.error") }}
              </div>
            </div>

            <!-- Footer (fixed at bottom) -->
            <div class="modal-footer">
              <button class="btn-cancel" @click="close">
                {{ t("common.back") }}
              </button>
              <button
                class="btn-submit"
                :disabled="!canSubmit || submitting"
                @click="handleSubmit"
              >
                <svg
                  v-if="submitting"
                  class="btn-spinner"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {{ submitting ? t("report.submitting") : t("report.submit") }}
              </button>
            </div>
          </template>
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
  max-width: 580px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.08);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
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

.section {
  padding: 0.5rem 1.5rem;
}

.section-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin: 0 0 0.5rem;
}

.section-hint {
  font-size: 0.8rem;
  color: #64748b;
  margin: 0 0 0.75rem;
}

.suggest-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0;
  border: none;
  border-top: 1px solid #f1f5f9;
  border-radius: 0;
  background: transparent;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s;
  margin-top: 0.25rem;
}

.suggest-toggle:hover {
  color: var(--color-brand-500);
}

.toggle-icon {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.toggle-icon--open {
  transform: rotate(90deg);
}

.suggest-content {
  padding-top: 0.5rem;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 600px;
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
  font-family: system-ui, -apple-system, sans-serif;
  color: #1e293b;
  resize: vertical;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.proposal-textarea:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand-500) 10%, transparent);
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
  font-family: system-ui, -apple-system, sans-serif;
  color: #1e293b;
  resize: none;
  overflow: hidden;
  height: 1.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  transition: height 0.15s ease;
}

.footnote-input:focus {
  outline: none;
  border-color: var(--color-brand-500);
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
  padding: 1px 3px;
  border-radius: 3px;
}

.diff-delete {
  background: #fee2e2;
  color: #991b1b;
  text-decoration: line-through;
  padding: 1px 3px;
  border-radius: 3px;
}

.name-field {
  padding-top: 0.25rem;
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
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-brand-500) 10%, transparent);
}

.success-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem 2rem;
  gap: 0.75rem;
}

.success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #dcfce7;
  color: #16a34a;
}

.success-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #166534;
  margin: 0;
  text-align: center;
}

.btn-success-close {
  margin-top: 0.5rem;
  padding: 8px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-success-close:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.verification-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem 2.5rem;
  gap: 1rem;
}

.verification-hint {
  font-size: 0.85rem;
  color: #64748b;
  text-align: center;
  margin: 0;
}

.turnstile-wrapper {
  display: flex;
  justify-content: center;
  padding: 0.5rem 1.5rem;
}

.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
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
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: var(--color-brand-500);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-submit:hover:not(:disabled) {
  background: var(--color-brand-600);
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
