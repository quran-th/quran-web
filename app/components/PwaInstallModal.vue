<script setup lang="ts">
import { usePwaInstall } from '~/composables/usePwaInstall'
import type { PwaStepIconName } from '~/components/PwaStepIcon.vue'

const { t } = useI18n()
const { canShow, platform, hasDeferredPrompt, triggerInstall, dismiss } = usePwaInstall()

// Icon shown inline for each step, mirroring the browser UI the user must tap.
const STEP_ICONS: Record<'ios' | 'android' | 'desktop', (PwaStepIconName | null)[]> = {
  ios: ['share', 'add', null],
  android: ['menu', 'install-phone', null],
  desktop: ['install-desktop', null],
}

const showSteps = ref(false)
const stepsPlatform = computed(() => (platform.value === 'ios' || platform.value === 'android') ? platform.value : 'desktop')
const steps = computed(() => STEP_ICONS[stepsPlatform.value].map((icon, i) => ({
  keypath: `pwa_install.steps.${stepsPlatform.value}.${i + 1}`,
  icon,
})))

// No native prompt (iOS, Firefox, or Chrome before it fires) — fall back to manual steps.
function onInstallClick() {
  if (hasDeferredPrompt.value) {
    triggerInstall()
    return
  }
  showSteps.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showSteps.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="pwa-slide-up">
    <div
      v-if="canShow"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-6 sm:bottom-8 sm:px-4 lg:justify-start lg:px-8"
      role="dialog"
      aria-modal="false"
      :aria-label="t('pwa_install.title')"
    >
      <div class="pointer-events-auto relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:max-w-lg sm:p-4 lg:max-w-xs lg:p-3">
        <div class="flex items-center gap-3 sm:gap-4 lg:gap-3">
          <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-100 via-teal-100 to-sky-100 sm:h-14 sm:w-14 lg:h-11 lg:w-11">
            <img
              src="/icon512_rounded.png"
              alt=""
              class="h-9 w-9 rounded-lg sm:h-10 sm:w-10 lg:h-8 lg:w-8"
            >
          </div>

          <div class="min-w-0 flex-1 pr-6">
            <h2 class="text-sm font-semibold text-slate-900 sm:text-base lg:text-sm">
              {{ t('pwa_install.title') }}
            </h2>
            <div class="mt-0.5 text-[11px] leading-snug text-slate-400 sm:text-xs lg:text-[11px]">
              {{ t('pwa_install.description') }}
            </div>
          </div>
        </div>

        <div class="mt-3 flex justify-center lg:mt-2.5 lg:justify-start">
          <button
            type="button"
            class="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] sm:px-6 sm:text-sm lg:px-5 lg:text-xs"
            @click="onInstallClick"
          >
            {{ t(`pwa_install.install_button.${stepsPlatform === 'desktop' ? 'desktop' : 'mobile'}`) }}
          </button>
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

  <Teleport to="body">
    <Transition name="pwa-steps">
      <div
        v-if="showSteps"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
        @click.self="showSteps = false"
      >
        <div
          class="pwa-steps-panel relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          role="dialog"
          aria-modal="true"
          :aria-label="t('pwa_install.steps_title')"
        >
          <h2 class="text-base font-semibold text-slate-900">
            {{ t('pwa_install.steps_title') }}
          </h2>

          <ol class="mt-4 space-y-3">
            <li
              v-for="(step, i) in steps"
              :key="step.keypath"
              class="flex items-start gap-3"
            >
              <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                {{ i + 1 }}
              </span>
              <i18n-t
                :keypath="step.keypath"
                tag="span"
                scope="global"
                class="pt-1 text-sm leading-7 text-slate-700"
              >
                <template #icon>
                  <PwaStepIcon
                    v-if="step.icon"
                    :name="step.icon"
                  />
                </template>
              </i18n-t>
            </li>
          </ol>

          <button
            type="button"
            class="mt-5 w-full rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
            @click="showSteps = false"
          >
            {{ t('pwa_install.steps_done') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
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

.pwa-steps-enter-active,
.pwa-steps-leave-active {
  transition: opacity 0.2s ease;
}

.pwa-steps-enter-active .pwa-steps-panel,
.pwa-steps-leave-active .pwa-steps-panel {
  transition: transform 0.2s ease;
}

.pwa-steps-enter-from,
.pwa-steps-leave-to {
  opacity: 0;
}

.pwa-steps-enter-from .pwa-steps-panel,
.pwa-steps-leave-to .pwa-steps-panel {
  transform: scale(0.95) translateY(8px);
}
</style>
