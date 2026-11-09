<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRecitationStore, PLAYBACK_SPEEDS, MAX_REPEAT, MAX_PAUSE_SECONDS } from "~/stores/recitationStore";
import { getReciterLabelTh, reciterMatchesQuery } from "~/data/reciter-names-th";
import WheelPicker from "~/components/reading/WheelPicker.vue";
import { useReaderSettingsStore } from "~/stores/readerSettingsStore";
import { useReciterPreview } from "~/composables/useReciterPreview";

const recitation = useRecitationStore();
const {
  status,
  activeVerseKey,
  reciterId,
  reciters,
  playbackRate,
  repeatCount,
  pauseSeconds,
  translationAudio,
  phase,
  currentChapterHasTranslation,
} = storeToRefs(recitation);

const readerSettings = useReaderSettingsStore();
const { selectedSourceId, translationSources, mukhtasarSourceId } = storeToRefs(readerSettings);
const selectedSource = computed(() => translationSources.value.find((s) => s.id === selectedSourceId.value));
const switchesSource = computed(
  () => mukhtasarSourceId.value !== undefined && selectedSourceId.value !== mukhtasarSourceId.value,
);

// The Thai audio reads Al-Mukhtasar, so the text on screen is switched to match it
function enableTranslationAudio() {
  recitation.setTranslationAudio("mukhtasar");
  if (switchesSource.value) readerSettings.setTranslationSource(mukhtasarSourceId.value);
  promoDismissed.value = true;
}

function enableFromPromo() {
  enableTranslationAudio();
  recitation.reportHint = true;
}

function toggleTranslationAudio() {
  if (translationAudio.value === "mukhtasar") recitation.setTranslationAudio("off");
  else enableTranslationAudio();
}

const promoDismissed = useCookie<boolean>("translation-audio-promo-dismissed", {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
});
const showPromo = computed(
  () =>
    recitation.translationAudioEnabled &&
    translationAudio.value === "off" &&
    currentChapterHasTranslation.value &&
    !promoDismissed.value &&
    !settingsView.value,
);

function selectSource(id: number) {
  readerSettings.setTranslationSource(id);
  settingsView.value = "root";
}

type SettingsView = "root" | "qari" | "play" | "source";
const settingsView = ref<SettingsView | null>(null);
const speedOptions = PLAYBACK_SPEEDS.map((v) => ({ value: v as number, label: `${v}x` }));
const repeatOptions = Array.from({ length: MAX_REPEAT }, (_, i) => ({ value: i + 1, label: `${i + 1}x` }));
const pauseOptions = Array.from({ length: MAX_PAUSE_SECONDS + 1 }, (_, i) => ({
  value: i,
  label: i === 0 ? "ปิด" : `${i} วิ`,
}));

type PlayFieldKey = "speed" | "repeat" | "pause";
const openField = ref<PlayFieldKey | null>(null);

interface PlayField {
  key: PlayFieldKey;
  title: string;
  value: number;
  options: { value: number; label: string }[];
  set: (value: number) => void;
}

const playFields = computed(() => {
  const fields: PlayField[] = [
    { key: "speed", title: "ความเร็ว", value: playbackRate.value, options: speedOptions, set: recitation.setPlaybackRate },
    { key: "repeat", title: "อ่านซ้ำแต่ละอายะห์", value: repeatCount.value, options: repeatOptions, set: recitation.setRepeatCount },
    { key: "pause", title: "หยุดพักหลังแต่ละอายะห์", value: pauseSeconds.value, options: pauseOptions, set: recitation.setPauseSeconds },
  ];
  return fields.map((f) => ({
    ...f,
    valueLabel: f.options.find((o) => o.value === f.value)?.label ?? "",
  }));
});

const playSummary = computed(() => {
  const parts = [`${playbackRate.value}x`];
  if (repeatCount.value > 1) parts.push(`ซ้ำ ${repeatCount.value} รอบ`);
  if (pauseSeconds.value > 0) parts.push(`เว้น ${pauseSeconds.value} วิ`);
  if (translationAudio.value === "mukhtasar") parts.push("คำแปล");
  return parts.join(" · ");
});

function toggleSettings(view: SettingsView) {
  settingsView.value = settingsView.value === view ? null : view;
}
const playerRef = ref<HTMLElement | null>(null);

const verseLabel = computed(() => {
  const verse = activeVerseKey.value?.split(":")[1];
  if (phase.value === "translation") return verse ? `กำลังฟังคำแปล อายะห์ ${verse}` : "กำลังฟังคำแปล";
  if (verse) return `อายะห์ ${verse}`;
  // Paused without an active verse = play() was blocked by autoplay policy
  return status.value === "loading" ? "กำลังโหลด…" : "แตะเพื่อเริ่มฟัง";
});

const currentReciterLabel = computed(() => {
  const reciter = reciters.value.find((r) => r.id === reciterId.value);
  return reciter ? getReciterLabelTh(reciter) : "";
});

const reciterQuery = ref("");
const reciterSearchRef = ref<HTMLInputElement | null>(null);
const filteredReciters = computed(() =>
  reciters.value
    .filter((r) => reciterMatchesQuery(r, reciterQuery.value))
    .sort((a, b) => getReciterLabelTh(a).localeCompare(getReciterLabelTh(b), "th") || a.style.localeCompare(b.style, "en")),
);

const { previewId, previewLoading, togglePreview, stopPreview } = useReciterPreview(recitation.loadTimings);

function onPreviewClick(id: number) {
  if (status.value === "playing") recitation.togglePause();
  togglePreview(id);
}

function selectReciter(id: number) {
  stopPreview();
  recitation.setReciter(id);
  settingsView.value = null;
}

function onDocumentPointerDown(e: PointerEvent) {
  if (!playerRef.value?.contains(e.target as Node)) {
    settingsView.value = null;
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") settingsView.value = null;
}

watch(settingsView, async (view) => {
  if (view !== "qari") stopPreview();
  openField.value = null;
  reciterQuery.value = "";
  // Touch devices would pop the keyboard over the list, so only focus with a mouse
  if (view === "qari" && window.matchMedia("(pointer: fine)").matches) {
    await nextTick();
    reciterSearchRef.value?.focus();
  }
});

watch(status, (s) => {
  if (s === "idle") settingsView.value = null;
  if (s === "playing") stopPreview();
});

onMounted(() => {
  recitation.fetchReciters();
  readerSettings.fetchTranslationSources();
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeydown);
});
</script>

<template>
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-200 ease-out"
    leave-active-class="transition duration-150 ease-in"
  >
    <div
      v-if="status !== 'idle'"
      class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none"
    >
      <div ref="playerRef" class="pointer-events-auto relative w-full max-w-md">
        <!-- Mobile only: dims the page behind the bottom sheet -->
        <Transition
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
          enter-active-class="transition-opacity duration-200"
          leave-active-class="transition-opacity duration-150"
        >
          <div
            v-if="settingsView"
            class="fixed inset-0 z-40 bg-slate-900/40 sm:hidden"
            @click="settingsView = null"
          />
        </Transition>

        <!-- Settings: bottom sheet on mobile, floating panel above the bar on desktop -->
        <Transition
          enter-from-class="translate-y-full sm:translate-y-2 sm:opacity-0"
          leave-to-class="translate-y-full sm:translate-y-2 sm:opacity-0"
          enter-active-class="transition duration-250 ease-out"
          leave-active-class="transition duration-200 ease-in"
        >
          <div
            v-if="settingsView"
            class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:absolute sm:bottom-full sm:mb-2 sm:max-h-none sm:overflow-hidden sm:rounded-2xl sm:border sm:pb-0 sm:shadow-xl"
          >
            <div class="flex justify-center pb-1 pt-2.5 sm:hidden">
              <span class="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <template v-if="settingsView === 'root'">
              <div class="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-400">ตั้งค่า</div>
              <button
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                @click="settingsView = 'qari'"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-slate-700">ผู้อ่าน</span>
                  <span class="block truncate text-xs text-slate-400">{{ currentReciterLabel }}</span>
                </span>
                <svg class="shrink-0 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <button
                v-if="translationSources.length > 0"
                class="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                @click="settingsView = 'source'"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-slate-700">คำแปล</span>
                  <span class="block truncate text-xs text-slate-400">{{ selectedSource?.name || "ค่าเริ่มต้นของระบบ" }}</span>
                </span>
                <svg class="shrink-0 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <button
                v-if="recitation.translationAudioEnabled"
                role="switch"
                :aria-checked="translationAudio === 'mukhtasar'"
                class="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-4 py-1.5 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                @click="toggleTranslationAudio"
              >
                <span class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-700">ฟังอรรถาธิบายฉบับย่อ</span>
                  <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-amber-700">Beta</span>
                </span>
                <span
                  class="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
                  :class="translationAudio === 'mukhtasar' ? 'bg-amber-50 text-amber-700' : 'text-slate-400'"
                >
                  <svg v-if="translationAudio === 'mukhtasar'" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></svg>
                </span>
              </button>
              <button
                class="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                @click="settingsView = 'play'"
              >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-slate-700">ตัวเลือกการเล่น</span>
                  <span class="block truncate text-xs text-slate-400">{{ playSummary }}</span>
                </span>
                <svg class="shrink-0 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </template>

            <template v-else>
              <button
                class="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                @click="settingsView = 'root'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                {{ settingsView === "qari" ? "เลือกผู้อ่าน" : settingsView === "source" ? "เลือกคำแปล" : "ตัวเลือกการเล่น" }}
              </button>

              <div v-if="settingsView === 'qari'" class="border-b border-slate-100 px-3 py-2">
                <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-500/30">
                  <svg class="shrink-0 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    ref="reciterSearchRef"
                    v-model="reciterQuery"
                    type="text"
                    enterkeyhint="search"
                    aria-label="ค้นหาผู้อ่าน"
                    placeholder="ค้นหาชื่อ (ไทย / English / عربي)"
                    class="min-w-0 flex-1 border-none bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400 sm:text-sm"
                  >
                  <button
                    v-if="reciterQuery"
                    type="button"
                    aria-label="ล้างคำค้นหา"
                    class="-m-1 flex shrink-0 items-center justify-center rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                    @click="reciterQuery = ''; reciterSearchRef?.focus()"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </button>
                </div>
              </div>
              <p v-if="settingsView === 'qari' && filteredReciters.length === 0" class="px-4 py-6 text-center text-sm text-slate-400">
                ไม่พบผู้อ่านชื่อนี้
              </p>
              <ul v-if="settingsView === 'qari' && filteredReciters.length > 0" role="listbox" aria-label="เลือกผู้อ่าน" class="max-h-72 overflow-y-auto py-1">
                <li
                  v-for="r in filteredReciters"
                  :key="r.id"
                  role="option"
                  :aria-selected="r.id === reciterId"
                  class="flex items-center transition-colors"
                  :class="r.id === reciterId ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'"
                >
                  <button
                    class="ml-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
                    :class="previewId === r.id ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700'"
                    :aria-label="previewId === r.id ? 'หยุดตัวอย่าง' : `ฟังตัวอย่างเสียง ${getReciterLabelTh(r)}`"
                    :title="previewId === r.id ? 'หยุดตัวอย่าง' : 'ฟังตัวอย่าง (อัล-ฟาติหะฮ์)'"
                    @click="onPreviewClick(r.id)"
                  >
                    <svg v-if="previewId === r.id && previewLoading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
                    <svg v-else-if="previewId === r.id" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" /></svg>
                  </button>
                  <button
                    class="flex min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pl-2 pr-4 text-left text-sm"
                    @click="selectReciter(r.id)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate">{{ getReciterLabelTh(r) }}</span>
                      <span v-if="r.arabicName" class="block truncate text-xs text-slate-400"><bdi lang="ar">{{ r.arabicName }}</bdi></span>
                    </span>
                    <span class="flex shrink-0 items-center gap-2">
                      <span
                        v-if="r.hasWordTimings"
                        class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                      >ไฮไลต์ทีละคำ</span>
                      <svg v-if="r.id === reciterId" class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  </button>
                </li>
              </ul>

              <ul v-else-if="settingsView === 'source'" role="listbox" aria-label="เลือกคำแปล" class="max-h-72 overflow-y-auto py-1">
                <li v-for="src in translationSources" :key="src.id" role="option" :aria-selected="src.id === selectedSourceId">
                  <button
                    class="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                    :class="src.id === selectedSourceId ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'"
                    @click="selectSource(src.id)"
                  >
                    <span class="min-w-0 truncate">{{ src.name }}</span>
                    <svg v-if="src.id === selectedSourceId" class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                </li>
              </ul>

              <div v-else class="divide-y divide-slate-100">
                <div v-for="field in playFields" :key="field.key">
                  <button
                    class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    :aria-expanded="openField === field.key"
                    @click="openField = openField === field.key ? null : field.key"
                  >
                    <span class="text-sm font-medium text-slate-700">{{ field.title }}</span>
                    <span
                      class="rounded-lg px-2.5 py-1 text-sm tabular-nums transition-colors"
                      :class="openField === field.key ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'"
                    >{{ field.valueLabel }}</span>
                  </button>
                  <div v-if="openField === field.key" class="relative px-4 pb-2">
                    <div class="pointer-events-none absolute inset-x-4 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-slate-100" />
                    <WheelPicker
                      class="relative"
                      :label="field.title"
                      :model-value="field.value"
                      :options="field.options"
                      @update:model-value="field.set"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </Transition>

        <Transition
          enter-from-class="translate-y-2 opacity-0"
          leave-to-class="translate-y-2 opacity-0"
          enter-active-class="transition duration-250 ease-out"
          leave-active-class="transition duration-150 ease-in"
        >
          <div
            v-if="showPromo"
            role="status"
            class="absolute inset-x-0 bottom-full mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl"
          >
            <div class="flex items-start gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
              </span>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  ฟังกุรอานพร้อมสรุปความหมายจากตัฟซีรอัล-มุคตะศ็อร ภาษาไทย
                  <span class="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-amber-800">Beta</span>
                </p>
                <p class="mt-1 text-xs leading-relaxed text-slate-600">
                  ฟังคำแปลไทยต่อจากแต่ละอายะห์<template v-if="switchesSource"> และเปลี่ยนคำแปลเป็นอัล-มุคตะศ็อร</template>
                </p>
                <div class="mt-3 flex items-center gap-2">
                  <button
                    class="rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                    @click="enableFromPromo"
                  >
                    เปิดเสียงคำแปล
                  </button>
                  <button
                    class="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-amber-100 hover:text-slate-700"
                    @click="promoDismissed = true"
                  >
                    ไม่ใช่ตอนนี้
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <div
          class="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-800/95 p-2.5 shadow-lg backdrop-blur-xs"
        >
          <button
            class="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 transition-colors hover:bg-slate-200"
            :title="status === 'playing' ? 'หยุดชั่วคราว' : 'เล่นต่อ'"
            @click="recitation.togglePause()"
          >
            <svg v-if="status === 'loading'" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
            <svg v-else-if="status === 'playing'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
          </button>

          <button
            class="group flex min-w-0 flex-1 flex-col items-start text-left"
            aria-haspopup="listbox"
            :aria-expanded="settingsView === 'qari'"
            @click="toggleSettings('qari')"
          >
            <span class="text-sm font-medium text-slate-100">{{ verseLabel }}</span>
            <span class="flex w-full items-center gap-1 text-xs text-slate-400 transition-colors group-hover:text-slate-200">
              <span class="truncate">{{ currentReciterLabel }}</span>
              <svg class="shrink-0 transition-transform" :class="settingsView === 'qari' && 'rotate-180'" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            </span>
          </button>

          <button
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            :class="settingsView && 'bg-slate-700 text-white'"
            title="ตั้งค่า"
            aria-label="ตั้งค่า"
            :aria-expanded="!!settingsView"
            @click="toggleSettings('root')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="7" y2="7" /><line x1="4" x2="20" y1="17" y2="17" /><circle cx="9" cy="7" r="2.5" fill="currentColor" /><circle cx="15" cy="17" r="2.5" fill="currentColor" /></svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
