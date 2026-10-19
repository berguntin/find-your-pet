<script setup lang="ts">
    const menuOpen = ref(false)
    const route = useRoute()
    watch(
        () => route.fullPath,
        () => (menuOpen.value = false)
    )
</script>

<template>
    <header class="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/90 backdrop-blur">
        <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <AppLogo />

            <nav class="hidden items-center gap-2 md:flex" :aria-label="$t('main_navigation')">
                <NuxtLink to="/" class="btn btn-ghost btn-sm" active-class="bg-base-200">{{
                    $t('nav_search')
                }}</NuxtLink>
                <LanguageSwitch class="mx-2" />
                <NuxtLink to="/registrar" class="btn btn-primary btn-sm">
                    <Icon name="mdi:plus" size="1.1rem" />
                    {{ $t('publish_report') }}
                </NuxtLink>
            </nav>

            <div class="flex items-center gap-1 md:hidden">
                <NuxtLink to="/registrar" class="btn btn-primary btn-sm btn-circle" :aria-label="$t('publish_report')">
                    <Icon name="mdi:plus" size="1.25rem" />
                </NuxtLink>
                <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-circle"
                    :aria-expanded="menuOpen"
                    aria-controls="mobile-menu"
                    :aria-label="$t('menu')"
                    @click="menuOpen = !menuOpen"
                >
                    <Icon :name="menuOpen ? 'mdi:close' : 'mdi:menu'" size="1.5rem" />
                </button>
            </div>
        </div>

        <Transition name="menu">
            <div v-if="menuOpen" id="mobile-menu" class="border-t border-base-300/70 bg-base-100 md:hidden">
                <nav class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" :aria-label="$t('main_navigation')">
                    <NuxtLink to="/" class="btn btn-ghost justify-start">
                        <Icon name="mdi:magnify" size="1.25rem" /> {{ $t('nav_search') }}
                    </NuxtLink>
                    <NuxtLink to="/registrar" class="btn btn-ghost justify-start">
                        <Icon name="mdi:plus-circle-outline" size="1.25rem" /> {{ $t('publish_report') }}
                    </NuxtLink>
                    <div class="flex items-center justify-between px-4 py-2">
                        <span class="text-sm text-muted">{{ $t('language') }}</span>
                        <LanguageSwitch />
                    </div>
                </nav>
            </div>
        </Transition>
    </header>
</template>

<style scoped>
    .menu-enter-active,
    .menu-leave-active {
        transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .menu-enter-from,
    .menu-leave-to {
        opacity: 0;
        transform: translateY(-4px);
    }
</style>
