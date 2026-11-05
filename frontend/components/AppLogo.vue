<template>
    <NuxtLink to="/" class="flex items-center gap-2 font-extrabold text-lg sm:text-xl text-base-content">
        <span class="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-content shadow-sm">
            <Icon name="mdi:paw" size="1.25rem" />
        </span>
        <span>{{ $t('app_name') }}</span>
    </NuxtLink>
</template>
