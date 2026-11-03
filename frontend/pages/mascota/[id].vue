<script setup lang="ts">
    const route = useRoute()
    const { t, locale } = useI18n()

    const id = String(route.params.id)
    const api = usePetsApi()
    const { data: pet, error } = await useAsyncData(`pet-${id}`, () => api.get(id))

    useHead(useOpenGraph(pet.value ?? null))

    const title = computed(() => (pet.value ? pet.value.name || t(`unnamed_${pet.value.species}`) : ''))
    const longDate = computed(() =>
        pet.value
            ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeZone: 'UTC' }).format(
                  new Date(`${pet.value.eventDate}T00:00:00Z`)
              )
            : ''
    )
    const relativeDate = computed(() => (pet.value ? formatRelativeDate(pet.value.eventDate, locale.value) : ''))
    const isOpen = computed(() => pet.value?.resolution === 'open')
</script>

<template>
    <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6" :class="{ 'pb-28 md:pb-6': isOpen }">
        <NuxtLink to="/" class="btn btn-ghost btn-sm mb-4 -ml-3">
            <Icon name="mdi:arrow-left" /> {{ $t('back_to_reports') }}
        </NuxtLink>

        <EmptyState v-if="error || !pet" icon="mdi:paw-off-outline" :title="$t('pet_not_found')">
            <NuxtLink to="/" class="btn btn-primary btn-sm">{{ $t('back_to_reports') }}</NuxtLink>
        </EmptyState>

        <div v-else class="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
            <PetGallery :images="pet.images" :title="title" :sensitive="!pet.alive" />

            <!-- Details -->
            <section class="flex flex-col gap-5">
                <div class="flex flex-wrap gap-2">
                    <PetStatusBadge :pet="pet" />
                    <span v-if="!pet.alive" class="status-badge bg-neutral">{{ $t('deceased') }}</span>
                </div>
                <h1>{{ title }}</h1>

                <div v-if="pet.resolution === 'reunited'" class="alert bg-reunited text-white">
                    <Icon name="mdi:home-heart" size="1.5rem" />
                    <span>{{ $t('reunited_banner') }}</span>
                </div>

                <dl class="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                    <div>
                        <dt class="text-xs font-bold uppercase tracking-wide text-muted">{{ $t('species_label') }}</dt>
                        <dd class="mt-1 font-semibold">{{ $t(pet.species) }}</dd>
                    </div>
                    <div>
                        <dt class="text-xs font-bold uppercase tracking-wide text-muted">{{ $t('area_label') }}</dt>
                        <dd class="mt-1 font-semibold">{{ pet.location }}</dd>
                    </div>
                    <div class="col-span-2 sm:col-span-1">
                        <dt class="text-xs font-bold uppercase tracking-wide text-muted">
                            {{ pet.reportType === 'lost' ? $t('lost_on') : $t('found_on') }}
                        </dt>
                        <dd class="mt-1 font-semibold">
                            <time :datetime="pet.eventDate">{{ longDate }}</time>
                            <span class="block text-sm font-normal text-muted">{{ relativeDate }}</span>
                        </dd>
                    </div>
                </dl>

                <div>
                    <h2 class="mb-2 text-lg">{{ $t('description') }}</h2>
                    <p class="whitespace-pre-line leading-relaxed">{{ pet.description }}</p>
                </div>

                <div v-if="isOpen" class="surface space-y-4 p-5">
                    <div>
                        <h2 class="text-lg">
                            {{ pet.reportType === 'lost' ? $t('contact_title_lost') : $t('contact_title_found') }}
                        </h2>
                        <p class="text-sm text-muted">{{ $t('contact_hint') }}</p>
                    </div>
                    <p class="break-words font-semibold">{{ pet.contact }}</p>
                    <ContactActions :contact="pet.contact" />
                </div>

                <div class="flex items-center gap-3">
                    <ShareButton :pet="pet" :only-icon="false" class-name="btn-outline btn-primary" />
                    <span class="text-sm text-muted">{{ $t('share_hint') }}</span>
                </div>
            </section>
        </div>

        <!-- Mobile: contact always at hand -->
        <div
            v-if="pet && isOpen"
            class="fixed inset-x-0 bottom-0 z-20 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur md:hidden"
        >
            <ContactActions :contact="pet.contact" compact />
        </div>
    </div>
</template>
