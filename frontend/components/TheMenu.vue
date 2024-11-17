<script setup lang="ts">
    const props = defineProps<{
        modelValue?: boolean
    }>()
</script>

<template>
    <div class="h-full bg-base-100 lg:h-auto w-80 lg:w-auto">
        <label for="my-drawer" class="float-right lg:hidden neutral-content p-3">
            <Icon name="material-symbols:close" size="1.5rem" />
        </label>
        <ul class="menu flex-col bg-base-50 lg:flex-row lg:menu-horizontal gap-3">
            <li><NuxtLink to="/" class="btn btn-ghost" external>Inicio</NuxtLink></li>
            <li>
                <NuxtLink to="/registrar" class="btn btn-outline btn-primary btn-md md:btn-xl" external>
                    + Añadir mascota
                </NuxtLink>
            </li>
        </ul>
    </div>
</template>
