<script setup lang="ts">
    const { locale, setLocale } = useI18n()
    const languages = [
        { code: 'es', label: 'ES', name: 'Español' },
        { code: 'en', label: 'EN', name: 'English' }
    ] as const
</script>

<template>
    <div class="join" role="group" :aria-label="$t('language')">
        <button
            v-for="language in languages"
            :key="language.code"
            type="button"
            class="join-item btn btn-xs"
            :class="locale === language.code ? 'btn-neutral' : 'btn-ghost'"
            :aria-pressed="locale === language.code"
            :aria-label="language.name"
            @click="setLocale(language.code)"
        >
            {{ language.label }}
        </button>
    </div>
</template>
