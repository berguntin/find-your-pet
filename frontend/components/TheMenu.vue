<script setup lang="ts">
    const props = defineProps<{
        modelValue?: boolean
    }>()
    const { setLocale } = useI18n()
</script>

<template>
    <div class="h-full bg-base-100 lg:h-auto w-80 lg:w-auto">
        <label for="my-drawer" class="float-right lg:hidden neutral-content p-3">
            <Icon name="material-symbols:close" size="1.5rem" />
        </label>
        <ul class="menu flex-col bg-base-50 lg:flex-row lg:menu-horizontal gap-3">
            <li>
                <NuxtLink to="/" class="btn btn-ghost" external>{{ $t('home') }}</NuxtLink>
            </li>
            <li v-if="$i18n.locale !== 'en'">
                <button @click="setLocale('en')" class="btn btn-ghost">English</button>
            </li>
            <li v-if="$i18n.locale !== 'es'">
                <button @click="setLocale('es')" class="btn btn-ghost">Español</button>
            </li>
            <li>
                <NuxtLink to="/registrar" class="btn btn-outline btn-primary btn-md md:btn-xl" external>
                    {{ $t('add_pet') }}
                </NuxtLink>
            </li>
        </ul>
    </div>
</template>
