<script setup lang="ts">
    /** Confirmation after reporting: published, or waiting for a moderator. */
    const props = defineProps<{ pet: Pet }>()
    const emit = defineEmits<{ (e: 'startOver'): void }>()

    const approved = computed(() => props.pet.moderationStatus === 'approved')
</script>

<template>
    <div class="surface flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span
            class="grid h-16 w-16 place-items-center rounded-full text-white"
            :class="approved ? 'bg-found' : 'bg-reunited'"
        >
            <Icon :name="approved ? 'mdi:check' : 'mdi:clock-outline'" size="2rem" />
        </span>
        <h1 class="text-2xl sm:text-3xl">{{ approved ? $t('published_title') : $t('pending_title') }}</h1>
        <p class="max-w-md text-muted">{{ approved ? $t('published_text') : $t('pending_text') }}</p>
        <div class="mt-2 flex flex-wrap justify-center gap-2">
            <NuxtLink v-if="approved" :to="{ name: 'mascota-id', params: { id: pet.id } }" class="btn btn-primary">
                {{ $t('view_report') }}
            </NuxtLink>
            <NuxtLink to="/" class="btn btn-ghost">{{ $t('back_to_reports') }}</NuxtLink>
            <button class="btn btn-ghost" @click="emit('startOver')">{{ $t('publish_another') }}</button>
        </div>
    </div>
</template>
