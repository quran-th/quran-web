<script setup lang="ts">
import { usePwaInstall } from '~/composables/usePwaInstall'

const { t } = useI18n()
const { canShow, platform, hasDeferredPrompt, triggerInstall, dismiss } = usePwaInstall()
</script>

<template>
  <Transition name="pwa-slide-up">
    <div
      v-if="canShow"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-6 sm:bottom-8 sm:px-4"
      role="dialog"
      aria-modal="false"
      :aria-label="t('pwa_install.title')"
    >
      <div class="pointer-events-auto relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:max-w-lg sm:p-4 lg:max-w-xl">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 via-teal-100 to-sky-100 sm:h-14 sm:w-14">
            <img
              src="/icon512_rounded.png"
              alt=""
              class="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
            >
          </div>

          <div class="min-w-0 flex-1 pr-6">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base">
              {{ t('pwa_install.title') }}
            </h2>
            <div class="mt-0.5 text-[11px] leading-snug text-slate-400 sm:text-xs">
              {{ t('pwa_install.description') }}
            </div>
          </div>
        </div>

        <div
          v-if="platform !== 'ios' && hasDeferredPrompt"
          class="mt-3 flex justify-center"
        >
          <button
            type="button"
            class="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] sm:px-6 sm:text-sm"
            @click="triggerInstall"
          >
            {{ t('pwa_install.install_button') }}
          </button>
        </div>

        <div
          v-if="platform === 'ios'"
          class="mt-1.5 text-center text-xs leading-snug text-slate-600"
        >
          {{ t('pwa_install.ios_hint_prefix') }}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="inline-block h-3.5 w-3.5 align-[-0.2em] text-teal-600"
            aria-hidden="true"
          >
            <path d="M12 16V4" />
            <path d="M8 8l4-4 4 4" />
            <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
          </svg>
          {{ t('pwa_install.ios_hint_suffix') }}
        </div>
        <div
          v-else-if="platform !== 'ios' && !hasDeferredPrompt"
          class="mt-1.5 text-center text-xs leading-snug text-slate-600"
        >
          {{ t('pwa_install.android_fallback_hint') }}
        </div>

        <button
          type="button"
          class="absolute right-1.5 top-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          :aria-label="t('pwa_install.dismiss_label')"
          @click="dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-3.5 w-3.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-slide-up-enter-active,
.pwa-slide-up-leave-active {
  transition:
    transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 0.25s ease;
}

.pwa-slide-up-enter-from,
.pwa-slide-up-leave-to {
  transform: translateY(40px);
  opacity: 0;
}
</style>
