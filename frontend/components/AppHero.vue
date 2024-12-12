<script setup lang="ts">
    const emit = defineEmits<{
        (e: 'search', data: String): void
    }>()

    const emitSearch = (search: string) => {
        emit('search', search)
    }
</script>

<template>
    <div class="text-center p-5 bg-base-100">
        <h1 class="text-md text-secondary">{{ $t('mainpage_title') }}</h1>
        <p class="max-w-md mx-auto mt-3 text-balance text-center text-base-content">
            {{ $t('mainpage_subtitle_1') }}
            <br />
            {{ $t('we_need') }} <strong> {{ $t('your_help') }}</strong>
            {{ $t('mainpage_subtitle_2') }}
        </p>

        <AppSearch @update-query="emitSearch" />
    </div>
</template>
