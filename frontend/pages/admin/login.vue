<script setup lang="ts">
    definePageMeta({ layout: false })
    useHead({ title: 'Admin', meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

    const route = useRoute()
    const { loggedIn } = useUserSession()
    if (loggedIn.value) await navigateTo('/admin')

    const error = computed(() => {
        if (route.query.error === 'forbidden') return 'admin_login_forbidden'
        if (route.query.error === 'oauth') return 'admin_login_failed'
        return null
    })
</script>

<template>
    <main class="flex min-h-dvh items-center justify-center bg-base-200/60 px-4">
        <div class="surface w-full max-w-sm space-y-5 p-8 text-center">
            <Icon name="mdi:paw" size="2.5rem" class="text-primary" />
            <div>
                <h1 class="text-2xl sm:text-3xl md:text-3xl">{{ $t('admin_title') }}</h1>
                <p class="mt-1 text-sm text-muted">{{ $t('admin_login_hint') }}</p>
            </div>
            <div v-if="error" class="alert alert-error text-left text-sm" role="alert">
                <Icon name="mdi:alert-circle" size="1.25rem" />
                <span>{{ $t(error) }}</span>
            </div>
            <!-- A full page load: the OAuth flow leaves the app. -->
            <a href="/auth/google" class="btn btn-primary w-full">
                <Icon name="mdi:google" size="1.25rem" />
                {{ $t('admin_login_google') }}
            </a>
            <NuxtLink to="/" class="btn btn-ghost btn-sm">{{ $t('admin_back_to_site') }}</NuxtLink>
        </div>
    </main>
</template>
