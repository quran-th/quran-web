<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

type ReaderMode = "ayah" | "mushaf" | "book";

interface Props {
  mode: ReaderMode;
  links: { ayah?: string; mushaf?: string; book?: string };
  translationOn: boolean;
  rangeLabel?: string;
  hasPrev: boolean;
  hasNext: boolean;
  backTo: string;
  showTranslationToggle?: boolean;
}

withDefaults(defineProps<Props>(), { showTranslationToggle: true, rangeLabel: undefined });

const emit = defineEmits<{
  "toggle-translation": [];
  prev: [];
  next: [];
  listen: [];
  report: [];
  settings: [];
}>();

const tabs: { key: ReaderMode; label: string }[] = [
  { key: "ayah", label: "อายะห์" },
  { key: "mushaf", label: "มุศฮัฟ" },
  { key: "book", label: "หนังสือ" },
];

const menuOpen = ref(false);
const menuRoot = ref<HTMLElement | null>(null);
const menuTrigger = ref<HTMLElement | null>(null);

function pickMenuItem(event: "listen" | "report" | "settings") {
  menuOpen.value = false;
  if (event === "listen") emit("listen");
  else if (event === "report") emit("report");
  else emit("settings");
}

function handleOutsideClick(e: MouseEvent) {
  if (menuOpen.value && menuRoot.value && !menuRoot.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}

function menuItems() {
  return Array.from(menuRoot.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

watch(menuOpen, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  menuItems()[0]?.focus();
});

function handleMenuKeydown(e: KeyboardEvent) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const items = menuItems();
  const index = items.indexOf(document.activeElement as HTMLElement);
  const step = e.key === "ArrowDown" ? 1 : -1;
  items[(index + step + items.length) % items.length]?.focus();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && menuOpen.value) {
    menuOpen.value = false;
    menuTrigger.value?.focus();
  }
}

// A clicked button would keep focus, and the reader's arrow-key page turns then make
// Chrome paint a keyboard focus ring on it. Clicks don't take focus; Tab still does.
function keepFocusOffButtons(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("button")) e.preventDefault();
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleOutsideClick);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <header
    class="text-ink [&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-offset-2 [&_:is(a,button):focus-visible]:outline-solid [&_:is(a,button):focus-visible]:outline-sage-500/60"
    @mousedown="keepFocusOffButtons"
  >
    <!-- Wide -->
    <div class="hidden h-16 items-center px-4 md:flex">
      <div class="flex flex-1 items-center gap-1">
        <NuxtLink
          :to="backTo"
          aria-label="กลับ"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon hover:bg-paper-tint"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </NuxtLink>
        <button
          v-if="showTranslationToggle"
          type="button"
          :aria-pressed="translationOn"
          class="flex h-11 items-center gap-2.5 rounded-xl px-2 hover:bg-paper-tint"
          @click="emit('toggle-translation')"
        >
          <span
            class="relative h-6 w-10 shrink-0 rounded-full transition-colors"
            :class="translationOn ? 'bg-sage-500' : 'bg-paper-tray'"
          >
            <span
              class="absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-paper-pill shadow-[0_1px_2px_rgba(60,45,25,0.25)] transition-transform"
              :class="translationOn ? 'translate-x-4' : 'translate-x-0'"
            />
          </span>
          <span class="text-[15px] font-medium text-ink">คำแปล</span>
        </button>
      </div>

      <nav aria-label="โหมดการอ่าน" class="flex gap-[2px] rounded-xl bg-paper-tray p-1">
        <template v-for="tab in tabs" :key="tab.key">
          <template v-if="links[tab.key]">
            <span
              v-if="mode === tab.key"
              aria-current="page"
              class="flex h-9 items-center rounded-[9px] bg-paper-pill px-5 text-sm font-semibold text-ink shadow-pill"
            >{{ tab.label }}</span>
            <NuxtLink
              v-else
              :to="links[tab.key]!"
              class="flex h-9 items-center rounded-[9px] px-5 text-sm font-medium text-ink-icon"
            >{{ tab.label }}</NuxtLink>
          </template>
        </template>
      </nav>

      <div class="flex flex-1 items-center justify-end gap-1">
        <button
          type="button"
          aria-label="หน้าถัดไป"
          :disabled="!hasNext"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon hover:bg-paper-tint disabled:opacity-30"
          @click="emit('next')"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span v-if="rangeLabel" class="min-w-[72px] text-center text-sm tabular-nums text-ink-icon">{{ rangeLabel }}</span>
        <button
          type="button"
          aria-label="หน้าก่อนหน้า"
          :disabled="!hasPrev"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon hover:bg-paper-tint disabled:opacity-30"
          @click="emit('prev')"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        <button
          type="button"
          aria-label="แจ้งข้อผิดพลาด"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon hover:bg-paper-tint"
          @click="emit('report')"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></svg>
        </button>
        <button
          type="button"
          class="flex h-11 items-center gap-1.5 rounded-xl px-3 text-ink-icon hover:bg-paper-tint"
          @click="emit('listen')"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
          <span class="text-[15px] font-medium text-ink">ฟัง</span>
        </button>
        <button
          type="button"
          aria-label="ตั้งค่าการอ่าน"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon hover:bg-paper-tint"
          @click="emit('settings')"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
    </div>

    <!-- Phone -->
    <div class="flex h-14 items-center justify-between px-1.5 md:hidden">
      <NuxtLink
        :to="backTo"
        aria-label="กลับ"
        class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </NuxtLink>

      <nav aria-label="โหมดการอ่าน" class="flex gap-[2px] rounded-xl bg-paper-tray p-[3px]">
        <template v-for="tab in tabs" :key="tab.key">
          <template v-if="links[tab.key]">
            <span
              v-if="mode === tab.key"
              aria-current="page"
              class="flex h-[34px] items-center rounded-[9px] bg-paper-pill px-3 text-[13.5px] font-semibold text-ink shadow-pill"
            >{{ tab.label }}</span>
            <NuxtLink
              v-else
              :to="links[tab.key]!"
              class="flex h-[34px] items-center rounded-[9px] px-3 text-[13.5px] font-medium text-ink-icon"
            >{{ tab.label }}</NuxtLink>
          </template>
        </template>
      </nav>

      <div ref="menuRoot" class="relative flex items-center gap-0.5">
        <button
          v-if="showTranslationToggle"
          type="button"
          :aria-pressed="translationOn"
          class="h-8 rounded-full px-2.5 text-[13px] font-semibold"
          :class="translationOn ? 'bg-sage-wash text-sage-600' : 'bg-transparent text-ink-icon'"
          @click="emit('toggle-translation')"
        >
          คำแปล
        </button>
        <button
          ref="menuTrigger"
          type="button"
          aria-label="เมนูเพิ่มเติม"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          class="flex h-11 w-11 items-center justify-center rounded-xl text-ink-icon"
          @click="menuOpen = !menuOpen"
        >
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
        </button>
        <div
          v-if="menuOpen"
          role="menu"
          class="absolute right-0 top-full z-30 w-[220px] rounded-[14px] bg-paper-pill p-1.5 shadow-menu"
          @keydown="handleMenuKeydown"
        >
          <button
            type="button"
            role="menuitem"
            class="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink hover:bg-paper-tint"
            @click="pickMenuItem('listen')"
          >
            <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
            ฟังหน้านี้
          </button>
          <button
            type="button"
            role="menuitem"
            class="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink hover:bg-paper-tint"
            @click="pickMenuItem('report')"
          >
            <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></svg>
            แจ้งข้อผิดพลาด
          </button>
          <button
            type="button"
            role="menuitem"
            class="flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink hover:bg-paper-tint"
            @click="pickMenuItem('settings')"
          >
            <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            ตั้งค่าการอ่าน
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
