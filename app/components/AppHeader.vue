<script setup lang="ts">
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
  >
    <div class="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
      <NuxtLink class="flex items-center space-x-2" to="/">
        <span class="text-lg font-bold tracking-tight text-slate-900">
          อัลกุรอานแปลไทย
        </span>
      </NuxtLink>
      <nav class="ml-6 hidden items-center space-x-6 text-sm font-medium md:flex">
        <NuxtLink class="text-slate-600 transition-colors hover:text-slate-900" to="/">ซูเราะห์</NuxtLink>
      </nav>
    </div>
  </header>
</template>
