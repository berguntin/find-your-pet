<script setup lang="ts">
    const { t } = useI18n()
    const route = useRoute()
    const { loggedIn } = useUserSession()
    useHead({ title: () => t('auth_page_title'), meta: [{ name: 'robots', content: 'noindex' }] })

    const error = computed(() => {
        if (route.query.error === 'unverified') return 'auth_error_unverified'
        if (route.query.error === 'oauth') return 'auth_error_oauth'
        return null
    })
    const returnTo = computed(() => sameSitePath(route.query.returnTo))
    if (loggedIn.value) await navigateTo(returnTo.value)
</script>

<template>
    <div class="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center sm:px-6">
        <Icon name="mdi:paw" size="2.5rem" class="text-primary" />
        <h1 class="mt-3 text-3xl">{{ t('auth_page_title') }}</h1>
        <p class="mt-2 text-muted">{{ t('auth_page_intro') }}</p>
        <div v-if="error" class="alert alert-error mt-6 text-left text-sm" role="alert">
            <Icon name="mdi:alert-circle" size="1.25rem" />
            <span>{{ t(error) }}</span>
        </div>
        <LoginButton class="btn-block mt-6" :return-to="returnTo" />
        <p class="mt-4 text-xs text-muted">
            {{ t('auth_page_privacy') }}
            <NuxtLink to="/politica-de-privacidad" class="link">{{ t('privacy_policy') }}</NuxtLink>
        </p>
    </div>
</template>
