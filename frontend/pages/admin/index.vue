<script setup lang="ts">
    definePageMeta({ layout: 'admin', middleware: 'admin' })

    const { t } = useI18n()
    useHead({ title: () => t('admin_nav_overview') })

    const api = useAdminApi()
    const days = useAdminPeriod()
    const { data, error, status } = await useAsyncData(
        'admin-overview',
        () => Promise.all([api.stats(days.value), api.moderation(days.value)]),
        { watch: [days] }
    )
    const stats = computed(() => data.value?.[0])
    const moderation = computed(() => data.value?.[1])

    const series = computed<ChartSeries[]>(() => [
        { key: 'lost', label: t('admin_series_lost'), color: '#B42318' },
        { key: 'found', label: t('admin_series_found'), color: '#1F7A4D' }
    ])
    const species = ['dog', 'cat', 'other'] as const
    const lostTotal = computed(() => stats.value?.period.lost ?? 0)
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 class="text-2xl sm:text-3xl md:text-3xl">{{ $t('admin_nav_overview') }}</h1>
                <p class="text-sm text-muted">{{ $t('admin_overview_hint') }}</p>
            </div>
            <AdminPeriodSelect v-model="days" />
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ $t('error_try_later') }}</div>

        <template v-else-if="stats && moderation">
            <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" :class="{ 'opacity-60': status === 'pending' }">
                <AdminStatTile
                    :label="$t('admin_new_lost')"
                    icon="mdi:magnify"
                    :value="stats.period.lost"
                    :trend="percentChange(stats.period.lost, stats.previousPeriod.lost)"
                    :hint="$t('admin_vs_previous', { value: stats.previousPeriod.lost })"
                />
                <AdminStatTile
                    :label="$t('admin_new_found')"
                    icon="mdi:hand-heart"
                    :value="stats.period.found"
                    :trend="percentChange(stats.period.found, stats.previousPeriod.found)"
                    :hint="$t('admin_vs_previous', { value: stats.previousPeriod.found })"
                />
                <AdminStatTile
                    :label="$t('admin_reunited_period')"
                    icon="mdi:home-heart"
                    :value="stats.period.reunited"
                    :trend="percentChange(stats.period.reunited, stats.previousPeriod.reunited)"
                    :hint="$t('admin_vs_previous', { value: stats.previousPeriod.reunited })"
                />
                <AdminStatTile
                    :label="$t('admin_pending_review')"
                    icon="mdi:clock-outline"
                    :value="stats.totals.pendingReview"
                    :hint="$t('admin_review_now')"
                    to="/admin/mascotas?estado=pending_review"
                />
            </section>

            <section class="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div class="surface p-5">
                    <h2 class="mb-1 text-lg sm:text-lg">{{ $t('admin_new_reports_per_day') }}</h2>
                    <p class="mb-4 text-sm text-muted">{{ $t('admin_days_in_zone', { zone: stats.timeZone }) }}</p>
                    <AdminDailyChart :rows="stats.daily" :series="series" :label="$t('admin_new_reports_per_day')" />
                </div>

                <div class="surface space-y-4 p-5">
                    <h2 class="text-lg sm:text-lg">{{ $t('admin_lost_by_species') }}</h2>
                    <ul class="space-y-3">
                        <li v-for="kind in species" :key="kind" class="space-y-1">
                            <div class="flex justify-between text-sm">
                                <span>{{ $t(kind) }}</span>
                                <span class="font-bold tabular-nums">
                                    {{ stats.period.lostBySpecies[kind] }}
                                    <span class="font-normal text-muted"
                                        >· {{ percentOf(stats.period.lostBySpecies[kind], lostTotal) }}%</span
                                    >
                                </span>
                            </div>
                            <div class="h-2 overflow-hidden rounded-full bg-base-200" aria-hidden="true">
                                <div
                                    class="h-full rounded-full bg-lost"
                                    :style="{ width: `${percentOf(stats.period.lostBySpecies[kind], lostTotal)}%` }"
                                />
                            </div>
                        </li>
                    </ul>

                    <h2 class="pt-2 text-lg sm:text-lg">{{ $t('admin_board_now') }}</h2>
                    <dl class="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <dt class="text-muted">{{ $t('admin_open_lost') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ stats.totals.open.lost }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">{{ $t('admin_open_found') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ stats.totals.open.found }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">{{ $t('admin_total_reunited') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ stats.totals.reunited }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">{{ $t('admin_total_reports') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ stats.totals.all }}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section class="surface flex flex-wrap items-center justify-between gap-4 p-5">
                <div class="space-y-1">
                    <h2 class="text-lg sm:text-lg">{{ $t('admin_nav_moderation') }}</h2>
                    <p class="text-sm text-muted">
                        <template v-if="moderation.moderator.enabled">
                            {{
                                $t('admin_moderation_summary', {
                                    total: moderation.automatic.total,
                                    approved: percentOf(moderation.automatic.approved, moderation.automatic.total),
                                    review: percentOf(moderation.automatic.pendingReview, moderation.automatic.total),
                                    rejected: percentOf(moderation.automatic.rejected, moderation.automatic.total)
                                })
                            }}
                        </template>
                        <template v-else>{{ $t('admin_moderator_disabled') }}</template>
                    </p>
                </div>
                <NuxtLink :to="{ path: '/admin/moderacion', query: $route.query }" class="btn btn-outline btn-sm">
                    {{ $t('admin_see_moderation') }} <Icon name="mdi:arrow-right" />
                </NuxtLink>
            </section>
        </template>
    </div>
</template>
