<script setup>
    const { data } = await useAsyncData('politica-de-privacidad', () =>
        queryContent('/politica-de-privacidad').findOne()
    )
</script>

<template>
    <article
        class="prose mx-auto max-w-3xl px-4 py-8 text-base-content prose-headings:text-base-content prose-a:text-primary prose-strong:text-base-content sm:px-6 sm:py-12 [&_:is(h1,h2,h3,h4)_a]:[font-weight:inherit] [&_:is(h1,h2,h3,h4)_a]:[color:inherit] [&_:is(h1,h2,h3,h4)_a]:no-underline"
    >
        <ContentRenderer :value="data" />
    </article>
</template>
