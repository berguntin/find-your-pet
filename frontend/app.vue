<script setup>
    import { Analytics } from '@vercel/analytics/nuxt'

    useThemeSync()
</script>
<template>
    <NuxtLayout>
        <Analytics />
        <NuxtPage />
    </NuxtLayout>
</template>
