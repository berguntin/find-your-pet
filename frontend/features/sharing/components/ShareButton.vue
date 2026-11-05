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
            default: 'btn-primary'
        }
    })
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

    const options = useMetadata(props.pet)

    // On phones, the native share sheet reaches every app; the popup is the fallback.
    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: options.title, text: options.text, url: options.url })
                return
            } catch (error) {
                if (error?.name === 'AbortError') return
            }
        }
        togglePopup()
    }

    const togglePopup = () => {
        isActive.value = !isActive.value
        if (isActive.value) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
    }
</script>

<template>
    <div>
        <button
            ref="buttonRef"
            :class="['btn', className]"
            :aria-label="$t('share')"
            aria-haspopup="true"
            :aria-expanded="isActive.toString()"
            @click="share"
        >
            <Icon name="mdi:share-variant" size="1.25rem" />
            <span v-if="!onlyIcon">{{ $t('share') }}</span>
        </button>
        <Teleport to="body">
            <transition name="fade">
                <div v-if="isActive" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral/40">
                    <div
                        ref="popupRef"
                        class="bg-base-100 border border-base-content/20 text-base-content shadow-xl rounded-lg p-8 max-w-sm w-full mx-4 relative"
                        role="dialog"
                        aria-modal="true"
                    >
                        <button
                            @click="togglePopup"
                            class="absolute top-1 right-2 text-base-content/70 hover:text-base-content focus:outline-none focus:ring-2 focus:ring-base-content/20 rounded-full p-1 transition-colors duration-200"
                            :aria-label="$t('close')"
                        >
                            <Icon name="material-symbols:close" />
                        </button>
                        <ul class="space-y-2">
                            <li
                                v-for="network in networks"
                                :key="network.name"
                                :class="['rounded-md py-2 px-4 text-sm', network.color]"
                            >
                                <ShareNetworkLink :network="network" :options="options" />
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
