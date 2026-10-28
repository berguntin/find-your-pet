<script setup lang="ts">
    import type { PetMatchDto } from '~~/contracts/pets'

    /** Published pets that may be the same animal, so the user can check them before reporting it again. */
    defineProps<{ matches: PetMatchDto[] }>()
</script>

<template>
    <section role="status" class="surface space-y-3 p-4 ring-2 ring-accent">
        <div class="flex items-start gap-3">
            <Icon name="mdi:paw" size="1.5rem" class="shrink-0 text-accent" />
            <div>
                <h2 class="font-bold">{{ $t('similar_pets_title') }}</h2>
                <p class="text-sm text-muted">{{ $t('similar_pets_text') }}</p>
            </div>
        </div>
        <ul class="space-y-2">
            <li v-for="{ pet, match } in matches" :key="pet.id">
                <NuxtLink
                    :to="{ name: 'mascota-id', params: { id: pet.id } }"
                    target="_blank"
                    class="flex items-center gap-3 rounded-xl bg-base-200/60 p-2 transition hover:bg-base-200"
                >
                    <img
                        :src="pet.images[0]"
                        alt=""
                        class="h-14 w-14 shrink-0 rounded-lg object-cover"
                        :class="{ 'blur-sm': !pet.alive }"
                    />
                    <span class="min-w-0 flex-1">
                        <span class="block truncate font-semibold">
                            {{ pet.name || $t(`unnamed_${pet.species}`) }}
                        </span>
                        <span class="block truncate text-sm text-muted">
                            {{ $t(pet.reportType === 'lost' ? 'status_lost' : 'status_found') }} · {{ pet.location }}
                        </span>
                    </span>
                    <span class="shrink-0 text-sm font-extrabold text-accent">
                        {{ $t('match_percentage', { match }) }}
                    </span>
                    <Icon name="mdi:open-in-new" class="shrink-0 text-muted" />
                </NuxtLink>
            </li>
        </ul>
        <p class="text-sm text-muted">{{ $t('similar_pets_continue') }}</p>
    </section>
</template>
