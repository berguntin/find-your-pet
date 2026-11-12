<script setup lang="ts">
    const { preference } = useTheme()
    const options = [
        { value: 'light', icon: 'mdi:white-balance-sunny', label: 'theme_light' },
        { value: 'dark', icon: 'mdi:weather-night', label: 'theme_dark' },
        { value: 'system', icon: 'mdi:theme-light-dark', label: 'theme_system' }
    ] as const
</script>

<template>
    <div class="join" role="group" :aria-label="$t('theme')">
        <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="join-item btn btn-xs"
            :class="preference === option.value ? 'btn-neutral' : 'btn-ghost'"
            :aria-pressed="preference === option.value"
            :aria-label="$t(option.label)"
            :title="$t(option.label)"
            @click="preference = option.value"
        >
            <Icon :name="option.icon" size="0.9rem" aria-hidden="true" />
        </button>
    </div>
</template>
