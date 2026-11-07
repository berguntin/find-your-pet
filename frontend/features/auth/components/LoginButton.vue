<script setup lang="ts">
    const props = withDefaults(defineProps<{ returnTo?: string; label?: string; compact?: boolean }>(), {
        returnTo: undefined,
        label: 'auth_login_google',
        compact: false
    })
    const route = useRoute()
    const href = computed(() => loginUrl(props.returnTo ?? route.fullPath))
</script>

<template>
    <!-- A full page load: the OAuth flow leaves the app. -->
    <a :href="href" class="btn btn-primary" :aria-label="compact ? $t(label) : undefined">
        <Icon name="mdi:google" size="1.25rem" />
        <!-- Compact: icon only on small screens, so the header fits on a phone. -->
        <span :class="{ 'hidden md:inline': compact }">{{ $t(label) }}</span>
    </a>
</template>
