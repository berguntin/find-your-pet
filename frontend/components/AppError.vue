<script setup lang="ts">
    const props = defineProps<{
        error?: string
    }>()
</script>

<template>
    <div role="alert" class="alert alert-error max-w-96">
        <span class="text-center"> {{ error ?? $t('error_try_later') }}</span>
    </div>
</template>
