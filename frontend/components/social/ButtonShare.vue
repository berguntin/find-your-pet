<script setup>
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
    const runtimeConfig = useRuntimeConfig()
    const isActive = ref(false)
    const buttonRef = ref(null)
    const popupRef = ref(null)

    const networks = [
        {
            name: 'facebook',
            color: 'bg-[#1877F2] hover:bg-[#0E5A9E]',
            icon: 'ic:baseline-facebook'
        },
        {
            name: 'twitter',
            color: 'bg-[#1DA1F2] hover:bg-[#0C85D0]',
            icon: 'mdi:twitter'
        },
        {
            name: 'whatsapp',
            color: 'bg-[#25D366] hover:bg-[#128C7E]',
            icon: 'ic:baseline-whatsapp'
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

    const handleClickOutside = event => {
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

    const shareNetworkRef = ref(null)
    const runWorkaround = index => {
        if (shareNetworkRef.value[index] === null) return

        clearInterval(shareNetworkRef.value[index].popupInterval)
        shareNetworkRef.value[index].popupWindow = undefined
    }

    const handleEscapeKey = event => {
        if (isActive.value && event.key === 'Escape') {
            togglePopup()
        }
    }

    const options = useMetadata(props.pet)
</script>

<template>
    <div>
        <button
            ref="buttonRef"
            :class="['btn btn-primary flex items-center gap-1 px-2 py-1', className]"
            @click="togglePopup"
            aria-label="Compartir en redes"
            aria-haspopup="true"
            :aria-expanded="isActive.toString()"
        >
            <Icon name="material-symbols:share" size="1.5rem" />
            <span v-if="!onlyIcon">Compartir</span>
        </button>
        <Teleport to="body">
            <transition name="fade">
                <div
                    v-if="isActive"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-base-300 bg-opacity-50"
                >
                    <div
                        ref="popupRef"
                        class="bg-base-100 border border-base-content/20 text-base-content shadow-xl rounded-lg p-8 max-w-sm w-full mx-4 relative"
                        role="dialog"
                        aria-modal="true"
                    >
                        <button
                            @click="togglePopup"
                            class="absolute top-1 right-2 text-base-content/70 hover:text-base-content focus:outline-none focus:ring-2 focus:ring-base-content/20 rounded-full p-1 transition-colors duration-200"
                            aria-label="Cerrar"
                        >
                            <Icon name="material-symbols:close" />
                        </button>
                        <ul class="space-y-2">
                            <li
                                v-for="(network, index) in networks"
                                :key="network.name"
                                :class="['rounded-md py-2 px-4 text-sm', network.color]"
                            >
                                <SocialShare :network="network" :options="options" />
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
