<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt'
import { dataThemeFor, themeColorMetaFor } from '~/features/theme/utils/theme'

const { preference } = useTheme()
useHead(
    computed(() => ({
        htmlAttrs: { 'data-theme': dataThemeFor(preference.value) },
        meta: themeColorMetaFor(preference.value)
    }))
)
</script>
<template>
    <NuxtLayout>
        <Analytics/>
        <NuxtPage />
    </NuxtLayout>
</template>
