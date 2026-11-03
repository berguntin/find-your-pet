<script setup lang="ts">
    import { STATS_PERIODS } from '~~/contracts/admin'

    const days = defineModel<number>({ required: true })
</script>

<template>
    <div class="join" role="group" :aria-label="$t('admin_period')">
        <button
            v-for="period in STATS_PERIODS"
            :key="period"
            type="button"
            class="btn join-item btn-sm"
            :class="days === period ? 'btn-neutral' : 'btn-ghost bg-base-100'"
            :aria-pressed="days === period"
            @click="days = period"
        >
            {{ $t('admin_last_days', { days: period }) }}
        </button>
    </div>
</template>
