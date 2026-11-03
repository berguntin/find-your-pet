<script setup lang="ts">
    const props = defineProps<{
        images: string[]
        /** Accessible name of the photos. */
        title: string
        /** Photos of a deceased animal stay blurred until the visitor chooses to see them. */
        sensitive?: boolean
    }>()

    const activeImage = ref(0)
    const revealed = ref(false)
    const hidden = computed(() => props.sensitive && !revealed.value)
</script>

<template>
    <section :aria-label="$t('photos')">
        <div class="relative aspect-[4/3] overflow-hidden rounded-box bg-base-200">
            <img
                :src="images[activeImage]"
                :alt="`${title} – ${activeImage + 1}/${images.length}`"
                class="h-full w-full object-cover"
                :class="{ 'scale-110 blur-2xl': hidden }"
            />
            <div
                v-if="hidden"
                class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral/50 text-neutral-content"
            >
                <Icon name="mdi:eye-off-outline" size="2rem" />
                <p class="font-semibold">{{ $t('sensible_content') }}</p>
                <button class="btn btn-sm" @click="revealed = true">{{ $t('show_image') }}</button>
            </div>
        </div>
        <div v-if="images.length > 1" class="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
                v-for="(image, index) in images"
                :key="image"
                type="button"
                class="h-20 w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition"
                :class="index === activeImage ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100'"
                :aria-label="$t('show_photo', { n: index + 1 })"
                :aria-current="index === activeImage"
                @click="activeImage = index"
            >
                <img :src="image" alt="" class="h-full w-full object-cover" :class="{ 'blur-md': hidden }" />
            </button>
        </div>
    </section>
</template>
