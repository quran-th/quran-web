<script setup lang="ts">
const mobileMenuOpen = ref(false)
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
  >
    <div class="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
      <!-- Logo + Desktop nav -->
      <div class="flex items-center">
        <NuxtLink class="flex items-center space-x-2" to="/">
          <span class="text-lg font-bold tracking-tight text-slate-900">
            อัลกุรอานแปลไทย
          </span>
        </NuxtLink>
        <nav class="ml-6 hidden items-center space-x-6 text-sm font-medium md:flex">
          <NuxtLink class="text-slate-600 transition-colors hover:text-slate-900" to="/">ซูเราะห์</NuxtLink>
          <NuxtLink class="text-slate-600 transition-colors hover:text-slate-900" to="/page/1">มุศฮัฟ</NuxtLink>
        </nav>
      </div>

      <!-- Mobile hamburger -->
      <button
        class="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <!-- Close icon -->
        <svg
          v-if="mobileMenuOpen"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
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
        <!-- Hamburger icon -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Mobile menu dropdown -->
    <nav
      v-if="mobileMenuOpen"
      class="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
    >
      <NuxtLink
        class="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        to="/"
        @click="mobileMenuOpen = false"
      >
        ซูเราะห์
      </NuxtLink>
      <NuxtLink
        class="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        to="/page/1"
        @click="mobileMenuOpen = false"
      >
        มุศฮัฟ
      </NuxtLink>
    </nav>
  </header>
</template>
