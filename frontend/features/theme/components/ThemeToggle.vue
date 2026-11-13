<script setup lang="ts">
    const { effective, toggle } = useTheme()
    const { t } = useI18n()

    /** Announced to screen readers after the user switches, from this button only. */
    const announcement = ref('')
    const onClick = () => {
        toggle()
        announcement.value = effective.value === 'dark' ? t('theme_dark_enabled') : t('theme_light_enabled')
    }
</script>

<template>
    <span class="inline-flex">
        <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle"
            :aria-pressed="effective === null ? undefined : effective === 'dark'"
            :aria-label="$t('theme_dark_mode')"
            :title="$t('theme_dark_mode')"
            @click="onClick"
        >
            <!-- Until the system preference is known, keep the space so the header does not move. -->
            <Icon
                v-if="effective"
                :name="effective === 'dark' ? 'mdi:weather-night' : 'mdi:white-balance-sunny'"
                size="1.25rem"
                aria-hidden="true"
            />
            <span v-else class="inline-block h-5 w-5" aria-hidden="true" />
        </button>
        <!-- Outside the button so it does not become part of its name. -->
        <span class="sr-only" aria-live="polite">{{ announcement }}</span>
    </span>
</template>
