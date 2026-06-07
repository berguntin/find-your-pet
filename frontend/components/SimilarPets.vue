<template>
    <div class="alert alert-warning shadow-lg mb-4">
        <Icon name="heroicons:exclamation-triangle-20-solid" class="w-6 h-6 shrink-0" />
        <div class="flex-1">
            <p class="font-bold">{{ $t('similar_pets_found') }}</p>
            <p class="text-sm">{{ $t('similar_pets_description') }}</p>
        </div>
    </div>

    <div class="grid grid-cols-1 gap-4 mb-6">
        <NuxtLink
            v-for="pet in pets"
            :key="pet.id"
            :to="`/mascota/${pet.id}`"
            target="_blank"
            class="card card-side bg-base-100 shadow hover:shadow-md transition-shadow"
        >
            <figure class="w-28 shrink-0">
                <img
                    :src="Array.isArray(pet.images) ? pet.images[0] : pet.images"
                    :alt="pet.name || pet.type"
                    class="w-full h-full object-cover"
                />
            </figure>
            <div class="card-body p-3 gap-1">
                <div class="flex items-center gap-2">
                    <span
                        class="badge badge-sm"
                        :class="pet.status === 'lost' ? 'badge-error' : 'badge-warning'"
                    >
                        {{ pet.status === 'lost' ? $t('lost') : $t('found') }}
                    </span>
                    <span class="badge badge-sm badge-ghost">{{ pet.type }}</span>
                    <span class="badge badge-sm badge-success ml-auto">
                        {{ Math.round((pet.similarity ?? 0) * 100) }}% {{ $t('similar') }}
                    </span>
                </div>
                <p v-if="pet.name" class="font-semibold text-sm">{{ pet.name }}</p>
                <p class="text-xs text-base-content/70 line-clamp-2">{{ pet.description }}</p>
                <p class="text-xs text-base-content/50">📍 {{ pet.location }}</p>
            </div>
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
    defineProps<{
        pets: (Pet & { similarity?: number })[]
    }>()
</script>
