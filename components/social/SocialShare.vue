<script setup>
import { computed } from 'vue'
import { useRoute, useRuntimeConfig } from '#app'

const props = defineProps({
	network: {
    type: Object,
    required: true,
	},
	options: {
    type: Object,
    default: () =>( {
            title: '¡Mira esto!',
            hashtags: '',
            via: ''
    }),
    validator: (value) => {
            Array.from(Object.keys(value)).includes('title', 'url', 'hastags')
    }
	}
})

const route = useRoute()
const config = useRuntimeConfig()

const pageUrl = `${config.public.baseUrl}${route.fullPath}` 

const shareUrl = computed(() => {
  const { title, text, hashtags, quote } = props.options
  
  switch (props.network.toLowerCase()) {
    case 'facebook':
      // En Facebook se utiliza el parámetro 'u' para la URL que queremos compartir
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`
    case 'twitter':
      // En Twitter utilizamos los parámetros 'text', 'url', 'hashtags' y 'via'
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text || title)}&url=${encodeURIComponent(pageUrl)}&hashtags=${encodeURIComponent(hashtags)}&via=${encodeURIComponent(props.options.via || '')}`
    case 'whatsapp':
      // En WhatsApp, utilizamos 'text' para el mensaje completo
      return `https://wa.me/?text=${encodeURIComponent(`${text || title} ${pageUrl}`)}`
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
        <component :is="network.icon" class="h-5 w-5" />
      </a>
    </div>
  </template>

  