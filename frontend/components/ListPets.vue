<script setup lang="ts">
    defineProps<{
        pets: Pet[]
        /** Match percentage per pet id, for image search results. */
        matches?: Record<string, number>
        loading?: boolean
    }>()
</script>

<template>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" :aria-busy="loading">
        <template v-if="loading && pets.length === 0">
            <CardPetSkeleton v-for="i in 6" :key="i" />
        </template>
        <CardPet v-for="pet in pets" :key="pet.id" :pet="pet" :match="matches?.[pet.id]" />
    </div>
</template>
