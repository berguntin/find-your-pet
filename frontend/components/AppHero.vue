<script setup lang="ts">
    const emit = defineEmits<{
        (e: 'search', data: string): void
        (e: 'searchByImage', file: File): void
    }>()
</script>

<template>
    <section class="bg-gradient-to-b from-base-200 to-base-100">
        <div class="mx-auto max-w-6xl px-4 pb-5 pt-6 sm:px-6 sm:pb-10 sm:pt-14">
            <div class="max-w-2xl">
                <h1 class="text-balance text-[1.75rem] leading-tight sm:text-5xl">{{ $t('hero_title') }}</h1>
                <p class="mt-2 text-sm text-muted sm:mt-3 sm:text-lg">{{ $t('hero_subtitle') }}</p>
            </div>
            <PetSearchBar
                class="mt-5 max-w-2xl sm:mt-6"
                @update-query="text => emit('search', text)"
                @search-by-image="file => emit('searchByImage', file)"
            />
        </div>
    </section>
</template>
