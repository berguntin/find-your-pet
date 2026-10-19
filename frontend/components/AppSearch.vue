<script setup lang="ts">
    const emit = defineEmits<{
        (e: 'updateQuery', text: string): void
        (e: 'searchByImage', file: File): void
    }>()

    const searchQuery = ref('')
    const fileInput = ref<HTMLInputElement | null>(null)
    let timeout: ReturnType<typeof setTimeout> | undefined

    const handleSearch = () => {
        clearTimeout(timeout)
        timeout = setTimeout(() => emit('updateQuery', searchQuery.value.trim()), 400)
    }

    const clearSearch = () => {
        searchQuery.value = ''
        emit('updateQuery', '')
    }

    const handleImage = (event: Event) => {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        if (file) emit('searchByImage', file)
        // Allow picking the same photo again.
        input.value = ''
    }
</script>

<template>
    <div class="flex items-center gap-2 sm:gap-3">
        <form role="search" class="relative flex-1" @submit.prevent="emit('updateQuery', searchQuery.trim())">
            <label for="pet-search" class="sr-only">{{ $t('search_label') }}</label>
            <Icon
                name="mdi:magnify"
                size="1.4rem"
                class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
                id="pet-search"
                v-model="searchQuery"
                type="search"
                :placeholder="$t('search_placeholder')"
                class="input w-full rounded-full border-base-300 bg-white pl-12 pr-12 text-base shadow-sm focus:border-primary sm:input-lg"
                @input="handleSearch"
            />
            <button
                v-if="searchQuery"
                type="button"
                class="btn btn-ghost btn-sm btn-circle absolute right-3 top-1/2 -translate-y-1/2"
                :aria-label="$t('clear_search')"
                @click="clearSearch"
            >
                <Icon name="mdi:close" size="1.1rem" />
            </button>
        </form>
        <button
            type="button"
            class="btn btn-secondary btn-circle sm:btn-lg sm:w-auto sm:px-6"
            :aria-label="$t('search_by_photo')"
            :title="$t('search_by_photo')"
            @click="fileInput?.click()"
        >
            <Icon name="mdi:camera-outline" size="1.4rem" />
            <span class="hidden sm:inline">{{ $t('search_by_photo') }}</span>
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleImage" />
    </div>
</template>
