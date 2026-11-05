<script setup lang="ts">
    import type { ModerationScoresDto } from '~~/contracts/admin'

    defineProps<{ scores: ModerationScoresDto | null }>()

    const rows = [
        { key: 'isPetReport', label: 'admin_score_is_pet_report' },
        { key: 'showsAnimal', label: 'admin_score_shows_animal' },
        { key: 'inappropriate', label: 'admin_score_inappropriate' }
    ] as const
</script>

<template>
    <p v-if="!scores" class="text-sm text-muted">{{ $t('admin_no_scores') }}</p>
    <dl v-else class="grid gap-2">
        <div v-for="row in rows" :key="row.key" class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
            <dt>{{ $t(row.label) }}</dt>
            <dd class="font-bold tabular-nums">{{ formatProbability(scores[row.key]) }}</dd>
            <div class="col-span-2 h-1.5 overflow-hidden rounded-full bg-base-200" aria-hidden="true">
                <div class="h-full rounded-full bg-neutral/70" :style="{ width: `${(scores[row.key] ?? 0) * 100}%` }" />
            </div>
        </div>
    </dl>
</template>
