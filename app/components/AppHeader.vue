<script setup lang="ts">
import { ref } from "vue";

const showSettingsModal = ref(false);

function openSettings() {
  showSettingsModal.value = true;
}
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60"
  >
    <div
      class="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8 mx-auto"
    >
      <NuxtLink class="flex items-center space-x-2" to="/">
        <span class="text-lg font-bold tracking-tight text-slate-900">
          อัลกุรอานแปลไทย
        </span>
      </NuxtLink>
      <nav
        class="ml-6 hidden items-center space-x-6 text-sm font-medium md:flex"
      >
        <NuxtLink
          class="text-slate-600 transition-colors hover:text-slate-900"
          to="/"
        >
          ซูเราะห์
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center">
        <button
          class="settings-pill"
          title="ตั้งค่าการอ่าน"
          @click="openSettings"
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
            <path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>ตั้งค่า</span>
        </button>
      </div>
    </div>

    <SettingsReaderSettingsModal v-model:visible="showSettingsModal" />
  </header>
</template>

<style scoped>
.settings-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem 0.45rem 0.8rem;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  background: #f8fafc;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-pill:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #1e293b;
}

.settings-pill:active {
  transform: scale(0.97);
}

.settings-pill svg {
  flex-shrink: 0;
}
</style>
