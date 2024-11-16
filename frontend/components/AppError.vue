<script setup lang="ts">
    const props = defineProps<{
        error?: string
    }>()
</script>

<template>
    <div role="alert" class="alert alert-error max-w-96">
        <span class="text-center"> {{ error ?? 'Ups hubo un error intente más tarde.' }}</span>
    </div>
</template>
