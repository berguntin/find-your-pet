<script setup>
    const props = defineProps({
        network: {
            type: Object,
            required: true
        },
        options: {
            type: Object
        }
    })

    const route = useRoute()
    const config = useRuntimeConfig()

    const shareUrl = computed(() => {
        const { title, text, hashtags, quote, url, via } = props.options

        switch (props.network.name.toLowerCase()) {
            case 'facebook':
                // En Facebook se utiliza el parámetro 'u' para la URL que queremos compartir
                return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
            case 'twitter':
                // En Twitter utilizamos los parámetros 'text', 'url', 'hashtags' y 'via'
                return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || title)}
                &url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}&via=${encodeURIComponent(via || '')}`
            case 'whatsapp':
                return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`
            default:
                return '#'
        }
    })
</script>
<template>
    <div>
        <a
            :href="shareUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between w-full text-white"
        >
            <span class="capitalize">{{ network.name }}</span>
            <Icon :name="network.icon" />
        </a>
    </div>
</template>
