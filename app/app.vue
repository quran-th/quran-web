<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'th',
    dir: 'ltr',
  },
})

useSchemaOrg([
  defineWebSite({
    name: 'อัลกุรอานแปลไทย',
  }),
])
</script>
