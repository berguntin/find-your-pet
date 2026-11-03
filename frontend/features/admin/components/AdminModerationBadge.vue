<script setup lang="ts">
    const props = defineProps<{ status: 'approved' | 'pending_review' | 'rejected' }>()

    const styles = {
        approved: { class: 'bg-found/10 text-found', icon: 'mdi:check-circle', label: 'admin_status_approved' },
        pending_review: {
            class: 'bg-warning/30 text-base-content',
            icon: 'mdi:clock-outline',
            label: 'admin_status_pending_review'
        },
        rejected: { class: 'bg-lost/10 text-lost', icon: 'mdi:close-circle', label: 'admin_status_rejected' }
    } as const
    const style = computed(() => styles[props.status])
</script>

<template>
    <span
        class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
        :class="style.class"
    >
        <Icon :name="style.icon" aria-hidden="true" />
        {{ $t(style.label) }}
    </span>
</template>
