<script setup lang="ts">
    const props = defineProps<{
        pet: Pet
        /** Search similarity, 0–100. */
        match?: number
    }>()

    const { locale, t } = useI18n()
    const title = computed(() => props.pet.name || t(`unnamed_${props.pet.species}`))
    const when = computed(() => formatRelativeDate(props.pet.eventDate, locale.value))
    const speciesIcon = { dog: 'mdi:dog', cat: 'mdi:cat', other: 'mdi:rabbit' } as const
</script>

<template>
    <article
        class="surface group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
        <div class="relative aspect-[4/3] overflow-hidden bg-base-200">
            <img
                loading="lazy"
                :src="pet.images[0]"
                :alt="title"
                class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                :class="{ 'blur-xl scale-110': !pet.alive }"
            />
            <div
                v-if="!pet.alive"
                class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral/50 text-sm font-semibold text-neutral-content"
            >
                <Icon name="mdi:eye-off-outline" size="1.5rem" />
                {{ $t('sensible_content') }}
            </div>
            <div class="absolute left-3 top-3 flex flex-wrap gap-2">
                <PetStatusBadge :pet="pet" />
                <span v-if="!pet.alive" class="status-badge bg-neutral">{{ $t('deceased') }}</span>
            </div>
            <span
                v-if="match !== undefined"
                class="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-accent-content shadow-sm"
            >
                {{ $t('match_percentage', { match }) }}
            </span>
            <span
                v-if="pet.images.length > 1"
                class="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-neutral/70 px-2 py-0.5 text-xs text-neutral-content"
            >
                <Icon name="mdi:image-multiple-outline" size="0.9rem" /> {{ pet.images.length }}
            </span>
        </div>

        <div class="flex flex-1 flex-col gap-2 p-4">
            <h3 class="text-lg font-extrabold leading-tight">
                <!-- The link covers the whole card; the share button sits above it. -->
                <NuxtLink :to="{ name: 'mascota-id', params: { id: pet.id } }" class="after:absolute after:inset-0">
                    {{ title }}
                </NuxtLink>
            </h3>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span class="flex items-center gap-1"
                    ><Icon :name="speciesIcon[pet.species]" /> {{ $t(pet.species) }}</span
                >
                <span class="flex items-center gap-1"><Icon name="mdi:map-marker-outline" /> {{ pet.location }}</span>
                <span class="flex items-center gap-1">
                    <Icon name="mdi:calendar-blank-outline" />
                    <time :datetime="pet.eventDate">{{ when }}</time>
                </span>
            </p>
            <p class="line-clamp-2 text-sm">{{ pet.description }}</p>
        </div>
    </article>
</template>
