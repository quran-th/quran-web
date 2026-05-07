<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900">
    <AppHeader />
    <main>
      <slot />
    </main>
    <ClientOnly>
      <PwaInstallModal />
    </ClientOnly>
  </div>
</template>
