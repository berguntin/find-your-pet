<script setup lang="ts">
    const props = defineProps<{ modelValue: Filters }>()
    const emit = defineEmits<{ (e: 'update:modelValue', filters: Filters): void }>()

    const reportTypes = [
        { value: 'all', label: 'filter_all', icon: 'mdi:view-grid-outline' },
        { value: 'lost', label: 'filter_lost', icon: 'mdi:magnify' },
        { value: 'found', label: 'filter_found', icon: 'mdi:hand-heart-outline' }
    ] as const

    const species = [
        { value: 'all', label: 'filter_all_species', icon: 'mdi:paw' },
        { value: 'dog', label: 'filter_dogs', icon: 'mdi:dog' },
        { value: 'cat', label: 'filter_cats', icon: 'mdi:cat' },
        { value: 'other', label: 'filter_others', icon: 'mdi:rabbit' }
    ] as const

    const update = (patch: Partial<Filters>) => emit('update:modelValue', { ...props.modelValue, ...patch })
</script>

<template>
    <!-- One scrollable row on phones, wrapping on wider screens. -->
    <div
        class="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
        <div class="flex shrink-0 gap-2" role="group" :aria-label="$t('filter_by_type')">
            <button
                v-for="option in reportTypes"
                :key="option.value"
                type="button"
                class="btn btn-sm shrink-0 rounded-full"
                :class="
                    modelValue.reportType === option.value ? 'btn-neutral' : 'btn-ghost bg-white ring-1 ring-base-300'
                "
                :aria-pressed="modelValue.reportType === option.value"
                @click="update({ reportType: option.value })"
            >
                <Icon :name="option.icon" size="1rem" /> {{ $t(option.label) }}
            </button>
        </div>
        <span class="mx-1 h-6 w-px shrink-0 bg-base-300" aria-hidden="true" />
        <div class="flex shrink-0 gap-2" role="group" :aria-label="$t('filter_by_species')">
            <button
                v-for="option in species"
                :key="option.value"
                type="button"
                class="btn btn-sm shrink-0 rounded-full"
                :class="modelValue.species === option.value ? 'btn-neutral' : 'btn-ghost bg-white ring-1 ring-base-300'"
                :aria-pressed="modelValue.species === option.value"
                @click="update({ species: option.value })"
            >
                <Icon :name="option.icon" size="1rem" /> {{ $t(option.label) }}
            </button>
        </div>
    </div>
</template>
