<script setup>
    const { data } = await useAsyncData('politica-de-privacidad', () =>
        queryContent('/politica-de-privacidad').findOne()
    )
</script>

<template>
    <ContentRenderer :value="data" />
</template>
