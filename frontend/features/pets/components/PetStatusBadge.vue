<script setup lang="ts">
    const props = defineProps<{ pet: Pet }>()

    const status = computed(() => {
        if (props.pet.resolution === 'reunited')
            return { class: 'status-reunited', icon: 'mdi:home-heart', label: 'status_reunited' }
        if (props.pet.reportType === 'lost') return { class: 'status-lost', icon: 'mdi:magnify', label: 'status_lost' }
        return { class: 'status-found', icon: 'mdi:hand-heart', label: 'status_found' }
    })
</script>

<template>
    <span class="status-badge" :class="status.class">
        <Icon :name="status.icon" size="0.9rem" />
        {{ $t(status.label) }}
    </span>
</template>
