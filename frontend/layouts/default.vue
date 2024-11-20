<script setup lang="ts">
import { SpeedInsights } from "@vercel/speed-insights/nuxt"

const props = defineProps<{
    modelValue?: boolean
}>()
</script>

<template>
    <SpeedInsights/>
    <TheHeader />
    <main class="container mx-auto bg-base-100 min-h-lvh">
        <slot />
    </main>
    <TheFooter />
</template>
