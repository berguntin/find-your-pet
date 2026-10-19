<script setup>
    const searchQuery = ref('')
    const emits = defineEmits(['updateQuery', 'searchByImage'])
    const timeout = ref(null)
    const fileInput = ref(null)

    const handleSearch = () => {
        clearTimeout(timeout.value)
        timeout.value = setTimeout(() => {
            emits('updateQuery', searchQuery.value)
        }, 500)
    }

    const clearSearch = () => {
        searchQuery.value = ''
        emits('updateQuery', '')
    }

    const handleImage = event => {
        const [file] = event.target.files ?? []
        if (file) emits('searchByImage', file)
        // Allow picking the same photo again.
        event.target.value = ''
    }
</script>

<template>
    <div class="max-w-2xl mx-auto p-4 flex items-center gap-2">
        <div class="relative flex-1">
            <input
                type="text"
                v-model="searchQuery"
                :placeholder="$t('search')"
                class="w-full pl-10 pr-4 py-2 bg-base-300 rounded-full text-base-content placeholder-base-content/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition duration-300 ease-in-out"
                @input="handleSearch"
            />
            <div class="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Icon name="material-symbols:search" />
            </div>
            <button
                v-if="searchQuery"
                @click="clearSearch"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 focus:outline-none text-base-content/70 hover:text-base-content transition-colors duration-200"
            >
                <Icon name="material-symbols:close" />
            </button>
        </div>
        <button
            type="button"
            class="btn btn-circle btn-primary"
            :title="$t('search_by_photo')"
            :aria-label="$t('search_by_photo')"
            @click="fileInput?.click()"
        >
            <Icon name="material-symbols:photo-camera-outline" size="1.25rem" />
        </button>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleImage" />
    </div>
</template>
