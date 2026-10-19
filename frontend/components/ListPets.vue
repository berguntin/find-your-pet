<script setup lang="ts">
    defineProps<{
        pets: Pet[]
        /** Match percentage per pet id, for image search results. */
        matches?: Record<string, number>
    }>()
</script>

<template>
    <div class="mx-auto grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 my-5 p-5">
        <template v-for="pet in pets" :key="pet.id">
            <CardPet :pet="pet" :match="matches?.[pet.id]" />
        </template>
    </div>
</template>
