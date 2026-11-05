<script setup lang="ts">
    import { SpeedInsights } from '@vercel/speed-insights/nuxt'
</script>

<template>
    <div class="flex min-h-dvh flex-col">
        <SpeedInsights />
        <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn btn-sm">
            {{ $t('skip_to_content') }}
        </a>
        <TheHeader />
        <main id="main" class="flex-1">
            <slot />
        </main>
        <TheFooter />
    </div>
</template>
