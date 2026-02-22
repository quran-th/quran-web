<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
  >
    <div class="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
      <div class="mr-4 hidden md:flex">
        <NuxtLink class="mr-6 flex items-center space-x-2" to="/">
          <span class="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline-block">
            อัลกุรอานแปลไทย
          </span>
        </NuxtLink>
        <nav class="flex items-center space-x-6 text-sm font-medium">
          <NuxtLink class="text-slate-600 transition-colors hover:text-slate-900" to="/">ซูเราะห์</NuxtLink>
          <NuxtLink class="text-slate-600 transition-colors hover:text-slate-900" to="/page/1">มุษอฟ</NuxtLink>
        </nav>
      </div>
      <div class="flex flex-1 items-center justify-between space-x-2 md:justify-end">
        <div class="w-full flex-1 md:w-auto md:flex-none">
          <div class="relative w-full md:w-64">
            <input
              type="text"
              placeholder="ค้นหาซูเราะห์..."
              class="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-stone-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
