<script setup lang="ts">
    const props = defineProps<{ contact: string; compact?: boolean }>()

    const actions = computed(() => contactActions(props.contact))
    const visible = computed(() => (props.compact ? actions.value.slice(0, 2) : actions.value))
    const copied = ref(false)

    const META = {
        phone: { icon: 'mdi:phone', label: 'contact_call', class: 'btn-primary' },
        whatsapp: { icon: 'mdi:whatsapp', label: 'contact_whatsapp', class: 'btn-success' },
        email: { icon: 'mdi:email-outline', label: 'contact_email', class: 'btn-primary' },
        instagram: { icon: 'mdi:instagram', label: 'contact_instagram', class: 'btn-secondary' },
        link: { icon: 'mdi:open-in-new', label: 'contact_link', class: 'btn-secondary' }
    } as const

    const copy = async () => {
        await navigator.clipboard?.writeText(props.contact)
        copied.value = true
        setTimeout(() => (copied.value = false), 2000)
    }
</script>

<template>
    <div class="flex flex-wrap gap-2">
        <a
            v-for="action in visible"
            :key="action.kind + action.href"
            :href="action.href"
            :target="action.kind === 'phone' || action.kind === 'email' ? undefined : '_blank'"
            rel="noopener noreferrer"
            class="btn flex-1"
            :class="[META[action.kind].class, compact ? 'btn-md' : 'btn-md sm:flex-none']"
        >
            <Icon :name="META[action.kind].icon" size="1.25rem" />
            {{ $t(META[action.kind].label) }}
        </a>
        <button v-if="!compact" type="button" class="btn btn-ghost" @click="copy">
            <Icon :name="copied ? 'mdi:check' : 'mdi:content-copy'" size="1.1rem" />
            {{ copied ? $t('copied') : $t('copy_contact') }}
        </button>
    </div>
</template>
