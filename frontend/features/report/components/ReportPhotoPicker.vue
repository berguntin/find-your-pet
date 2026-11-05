<script setup lang="ts">
    import type { Photo } from '../composables/usePhotoSelection'

    defineProps<{ photos: Photo[]; max: number }>()
    const emit = defineEmits<{
        add: [files: FileList | File[] | null | undefined]
        remove: [index: number]
        setMain: [index: number]
    }>()

    const dragging = ref(false)

    const onDrop = (event: DragEvent) => {
        dragging.value = false
        emit('add', event.dataTransfer?.files)
    }
</script>

<template>
    <fieldset>
        <legend class="mb-1 font-bold">{{ $t('photos') }}</legend>
        <p class="mb-3 text-sm text-muted">{{ $t('photos_hint', { max }) }}</p>
        <label
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-6 py-10 text-center transition"
            :class="dragging ? 'border-primary bg-primary/5' : 'border-base-300 bg-white hover:border-primary/60'"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
        >
            <Icon name="mdi:camera-plus-outline" size="2.25rem" class="text-primary" />
            <span class="font-semibold">{{ $t('add_photos') }}</span>
            <span class="text-sm text-muted">{{ $t('add_photos_hint') }}</span>
            <input
                type="file"
                accept="image/*"
                multiple
                class="sr-only"
                :disabled="photos.length >= max"
                @change="event => emit('add', (event.target as HTMLInputElement).files)"
            />
        </label>
        <ul v-if="photos.length" class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            <li v-for="(photo, index) in photos" :key="photo.preview" class="relative aspect-square">
                <button
                    type="button"
                    class="block h-full w-full rounded-xl"
                    :class="index === 0 ? 'ring-2 ring-primary ring-offset-2' : 'opacity-90 hover:opacity-100'"
                    :aria-label="index === 0 ? $t('main_photo') : $t('set_main_photo')"
                    :aria-pressed="index === 0"
                    :title="index === 0 ? $t('main_photo') : $t('set_main_photo')"
                    @click="emit('setMain', index)"
                >
                    <img :src="photo.preview" alt="" class="h-full w-full rounded-xl object-cover" />
                </button>
                <span
                    class="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded-full px-2 text-xs"
                    :class="index === 0 ? 'bg-primary text-primary-content' : 'bg-neutral/60 text-neutral-content'"
                >
                    <Icon :name="index === 0 ? 'mdi:star' : 'mdi:star-outline'" />
                    <template v-if="index === 0">{{ $t('main_photo') }}</template>
                </span>
                <button
                    type="button"
                    class="btn btn-circle btn-xs absolute -right-2 -top-2 shadow"
                    :aria-label="$t('remove_photo')"
                    @click="emit('remove', index)"
                >
                    <Icon name="mdi:close" />
                </button>
            </li>
        </ul>
    </fieldset>
</template>
