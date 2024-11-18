<script setup lang="ts">
    const props = defineProps<{
        modelValue?: boolean
    }>()
</script>

<template>
    <header class="bg-base-50">
        <div class="container mx-auto flex items-center justify-between">
            <div>
                <p class="text-xl md:text-3xl text-primary font-bold;">
                    <NuxtLink to="/">{{ $t('header_title') }}</NuxtLink>
                </p>

                <p>{{ $t('header_desc') }}</p>
            </div>
            <TheNavBar />
        </div>
    </header>
</template>
