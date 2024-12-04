<script setup>
    const searchQuery = ref('')
    const emits = defineEmits(['updateQuery'])
    const timeout = ref(null)

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
</script>

<template>
    <div class="max-w-2xl w-full">
        <div class="relative">
            <input
                type="text"
                v-model="searchQuery"
                placeholder="Buscar..."
                class="w-full bg-primary/10 border border-primary/20 pl-10 pr-4 py-2 rounded-full text-base-content placeholder-base-content/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition duration-300 ease-in-out"
                @input="handleSearch"
            />
            <div class="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
                <Icon name="material-symbols:search" class="w-5 h-5" />
            </div>
            <button
                v-if="searchQuery"
                @click="clearSearch"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 focus:outline-none text-base-content/70 hover:text-base-content transition-colors duration-200 flex items-center"
            >
                <Icon name="material-symbols:close" />
            </button>
        </div>
    </div>
</template>
