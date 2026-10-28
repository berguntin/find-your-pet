<script setup lang="ts">
    defineProps<{
        label: string
        value: number | string
        icon?: string
        hint?: string
        /** Change against the previous period, in percent; null hides it. */
        trend?: number | null
        to?: string
    }>()

    const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
    <component
        :is="to ? NuxtLink : 'div'"
        :to="to"
        class="surface flex flex-col gap-1 p-4"
        :class="to ? 'transition hover:ring-primary/50' : ''"
    >
        <span class="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Icon v-if="icon" :name="icon" size="1rem" aria-hidden="true" />
            {{ label }}
        </span>
        <span class="text-3xl font-extrabold tabular-nums">{{ value }}</span>
        <span v-if="trend !== undefined || hint" class="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span v-if="trend !== undefined && trend !== null" class="inline-flex items-center gap-0.5 font-bold">
                <Icon
                    :name="trend > 0 ? 'mdi:arrow-up' : trend < 0 ? 'mdi:arrow-down' : 'mdi:minus'"
                    aria-hidden="true"
                />
                {{ $t('admin_trend', { value: Math.abs(trend) }) }}
            </span>
            <span v-if="hint">{{ hint }}</span>
        </span>
    </component>
</template>
