<script setup lang="ts">
    const props = defineProps<{
        modelValue?: boolean
    }>()
</script>

<template>
    <header class="bg-base-50">
        <div class="container mx-auto flex items-center justify-between">
            <div>
                <p class="text-xl md:text-3xl text-primary font-bold;">
                    <NuxtLink to="/">MASCOTAS DANA</NuxtLink>
                </p>

                <p>Mascotas Perdidas y Encontradas en Valencia</p>
            </div>
            <TheNavBar />
        </div>
    </header>
</template>
