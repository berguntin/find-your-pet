<script setup lang="ts">
    const { user, clear } = useUserSession()

    const links = [
        { to: '/admin', icon: 'mdi:chart-box-outline', label: 'admin_nav_overview', exact: true },
        { to: '/admin/mascotas', icon: 'mdi:paw', label: 'admin_nav_pets', exact: false },
        { to: '/admin/moderacion', icon: 'mdi:shield-check-outline', label: 'admin_nav_moderation', exact: false }
    ]

    const logout = async () => {
        await clear()
        await navigateTo('/admin/login')
    }

    useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
    <div class="flex min-h-dvh flex-col bg-base-200/60">
        <header class="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/95 backdrop-blur">
            <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
                <NuxtLink to="/admin" class="flex items-center gap-2 font-extrabold">
                    <Icon name="mdi:paw" size="1.5rem" class="text-primary" />
                    <span class="hidden sm:inline">{{ $t('admin_title') }}</span>
                </NuxtLink>
                <nav class="flex flex-1 items-center gap-1 overflow-x-auto" :aria-label="$t('admin_navigation')">
                    <NuxtLink
                        v-for="link in links"
                        :key="link.to"
                        :to="link.to"
                        class="btn btn-ghost btn-sm whitespace-nowrap"
                        :exact-active-class="link.exact ? 'btn-active' : undefined"
                        :active-class="link.exact ? undefined : 'btn-active'"
                    >
                        <Icon :name="link.icon" size="1.1rem" />
                        <span class="hidden md:inline">{{ $t(link.label) }}</span>
                    </NuxtLink>
                </nav>
                <div class="flex items-center gap-2">
                    <NuxtLink
                        to="/"
                        class="btn btn-ghost btn-sm btn-circle"
                        :aria-label="$t('admin_view_site')"
                        :title="$t('admin_view_site')"
                    >
                        <Icon name="mdi:open-in-new" size="1.1rem" />
                    </NuxtLink>
                    <div v-if="user" class="dropdown dropdown-end">
                        <button
                            type="button"
                            tabindex="0"
                            class="btn btn-ghost btn-sm btn-circle avatar"
                            :aria-label="user.email"
                        >
                            <img
                                v-if="user.picture"
                                :src="user.picture"
                                alt=""
                                class="w-8 rounded-full"
                                referrerpolicy="no-referrer"
                            />
                            <Icon v-else name="mdi:account-circle" size="1.75rem" />
                        </button>
                        <div
                            tabindex="0"
                            class="dropdown-content z-40 mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
                        >
                            <p class="truncate font-bold">{{ user.name }}</p>
                            <p class="truncate text-sm text-muted">{{ user.email }}</p>
                            <button type="button" class="btn btn-outline btn-sm mt-3 w-full" @click="logout">
                                <Icon name="mdi:logout" /> {{ $t('admin_logout') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
        <main id="main" class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
            <slot />
        </main>
    </div>
</template>
