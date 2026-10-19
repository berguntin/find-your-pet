<script setup lang="ts">
    defineProps<{ title: string; description?: string; icon?: string }>()
</script>

<template>
    <div class="surface mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
        <span class="grid h-14 w-14 place-items-center rounded-full bg-base-200 text-primary">
            <Icon :name="icon ?? 'mdi:paw-off-outline'" size="1.75rem" />
        </span>
        <h2 class="text-lg font-extrabold">{{ title }}</h2>
        <p v-if="description" class="text-sm text-muted">{{ description }}</p>
        <slot />
    </div>
</template>
