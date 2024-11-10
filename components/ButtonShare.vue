<script setup>
  import { ref, onMounted, onUnmounted } from 'vue'
  import { Share2Icon, FacebookIcon, TwitterIcon, Send, XIcon } from 'lucide-vue-next'
  
  const props = defineProps({
    pet: {
      type: Object,
      required: true
    },
    onlyIcon: {
      type: Boolean,
      default: false
    },
    className: {
      type: String,
      default: ''
    }
  })
  
  const isActive = ref(false)
  const buttonRef = ref(null)
  const popupRef = ref(null)
  
  const networks = [
    {
      name: 'facebook',
      color: 'bg-[#1877F2] hover:bg-[#0E5A9E]',
      icon: FacebookIcon
    },
    {
      name: 'twitter',
      color: 'bg-[#1DA1F2] hover:bg-[#0C85D0]',
      icon: TwitterIcon
    },
    {
      name: 'whatsapp',
      color: 'bg-[#25D366] hover:bg-[#128C7E]',
      icon: Send
    }
  ]
  
  const togglePopup = () => {
    isActive.value = !isActive.value
    if (isActive.value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
  
  const handleClickOutside = (event) => {
    if (
      isActive.value &&
      popupRef.value &&
      !popupRef.value.contains(event.target) &&
      buttonRef.value &&
      !buttonRef.value.contains(event.target)
    ) {
      togglePopup()
    }
  }
  
  const shareNetworkRef = ref(null);
  const runWorkaround = (index) => {
    console.log()
    if (shareNetworkRef.value[index] === null) return;

        clearInterval(shareNetworkRef.value[index].popupInterval);
        shareNetworkRef.value[index].popupWindow = undefined;
    }
  const handleEscapeKey = (event) => {
    if (isActive.value && event.key === 'Escape') {
      togglePopup()
    }
  }
  
  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)
  })
  
  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleEscapeKey)
  })
  
  const getTitle = () => {
    if (props.pet.athome) {
      return `${props.pet.name || 'Esta mascota'} ya está con su familia!`
    }
    return props.pet.status === 'lost' 
      ? `Ayúdame a encontrar a ${props.pet.name || 'mi mascota'}`
      : `¿Alguien lo busca?`
  }
  
  const getText = () => {
    if (props.pet.athome) {
      return 'Una historia con final feliz'
    }
    if (!props.pet.alive) {
      return `Tristemente, ha sido encontrado fallecido`
    }
    return props.pet.description || 'Mascotas perdidas y encontradas DANA Valencia'
  }
  
  const getUrl = () => {
    return `${window.location.origin}/mascota/${props.pet.id}`
  }
  
  const getHastags = () => {
    let hashtags = []
    hashtags.push(props.pet.status == 'lost' ? 'perdido' : 'encontrado')
    hashtags.push('DANA')
    hashtags.push('VLC')
    hashtags.push('ayuda')
    
    return hashtags.join(',')
  }
  </script>
<template>
    <div>
      <button
        ref="buttonRef"
        :class="['btn flex items-center gap-1 px-2 py-1', className]"
        @click="togglePopup"
        aria-label="Compartir en redes"
        aria-haspopup="true"
        :aria-expanded="isActive.toString()"
      >
        <Share2Icon class="h-4 w-4" />
        <span v-if="!onlyIcon">Compartir</span>
      </button>
      <Teleport to="body">
        <transition name="fade">
          <div v-if="isActive" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
              ref="popupRef"
              class="border bg-inherit border-solid border-gray-50 text-gray-800 shadow-xl rounded-lg p-8 max-w-sm w-full mx-4 relative"
              role="dialog"
              aria-modal="true"
            >
              <button 
                @click="togglePopup" 
                class="absolute top-1 text-sm right-2 text-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-full p-1"
                aria-label="Cerrar"
              >
                <XIcon class="h-6 w-6"/>
              </button>
              <ul class="space-y-2">
                <li 
                  v-for="(network, index) in networks" 
                  :key="network.name"
                  :class="['rounded-md py-2 px-4 text-sm', network.color]"
                >
                  <ShareNetwork
                    ref="shareNetworkRef" 
                    @open="runWorkaround(index)" 
                    :network="network.name"
                    :url="getUrl()"
                    :title="getTitle()"
                    :description="getText()"
                    :quote="getText()"
                    :hashtags="getHastags()"
                    :media="pet.images[0]"
                    class="flex items-center justify-between w-full text-white"
                  >
                    <span class="capitalize">{{ network.name }}</span>
                    <component :is="network.icon" class="h-5 w-5" />
                  </ShareNetwork>
                  
                </li>
              </ul>
            </div>
          </div>
        </transition>
      </Teleport>
    </div>
  </template>

  
  <style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  </style>