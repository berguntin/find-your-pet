<script setup lang="ts">
    import type { ModerationDecisionDto } from '~~/contracts/admin'

    definePageMeta({ layout: 'admin', middleware: 'admin' })

    const { t, locale } = useI18n()
    useHead({ title: () => t('admin_nav_moderation') })

    const api = useAdminApi()
    const days = useAdminPeriod()
    const {
        data: overview,
        error,
        status
    } = await useAsyncData('admin-moderation', () => api.moderation(days.value), {
        watch: [days]
    })

    // Approved / review / rejected: validated together for colour blindness; review is the darker amber
    // so it stays visible on the cream surface.
    const series = computed<ChartSeries[]>(() => [
        { key: 'approved', label: t('admin_status_approved'), color: '#1F7A4D' },
        { key: 'pendingReview', label: t('admin_status_pending_review'), color: '#C98500' },
        { key: 'rejected', label: t('admin_status_rejected'), color: '#B42318' }
    ])

    const thresholds = computed(() => {
        const th = overview.value?.moderator.thresholds
        if (!th) return []
        return [
            {
                label: 'admin_rule_approve',
                values: [
                    t('admin_rule_is_pet_at_least', { value: formatProbability(th.approveIsPetReport) }),
                    t('admin_rule_shows_animal_at_least', { value: formatProbability(th.approveShowsAnimal) }),
                    t('admin_rule_inappropriate_below', { value: formatProbability(th.approveInappropriate) })
                ]
            },
            {
                label: 'admin_rule_reject',
                values: [
                    t('admin_rule_is_pet_below', { value: formatProbability(th.rejectIsPetReport) }),
                    t('admin_rule_inappropriate_at_least', { value: formatProbability(th.rejectInappropriate) })
                ]
            },
            { label: 'admin_rule_review', values: [t('admin_rule_review_rest')] }
        ]
    })

    const dateTime = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }))
    const describe = (decision: ModerationDecisionDto) =>
        decision.submission
            ? decision.submission.name || decision.submission.description
            : decision.petId
            ? t('admin_admin_action')
            : '—'
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h1 class="text-2xl sm:text-3xl md:text-3xl">{{ $t('admin_nav_moderation') }}</h1>
                <p class="text-sm text-muted">{{ $t('admin_moderation_hint') }}</p>
            </div>
            <AdminPeriodSelect v-model="days" />
        </div>

        <div v-if="error" class="alert alert-error" role="alert">{{ $t('error_try_later') }}</div>

        <template v-else-if="overview">
            <div v-if="!overview.moderator.enabled" class="alert alert-warning" role="status">
                <Icon name="mdi:alert" size="1.25rem" />
                <span>{{ $t('admin_moderator_disabled') }}</span>
            </div>

            <section class="grid grid-cols-2 gap-3 lg:grid-cols-5" :class="{ 'opacity-60': status === 'pending' }">
                <AdminStatTile
                    :label="$t('admin_reviewed')"
                    icon="mdi:robot-outline"
                    :value="overview.automatic.total"
                />
                <AdminStatTile
                    :label="$t('admin_published')"
                    icon="mdi:check-circle-outline"
                    :value="overview.automatic.approved"
                    :hint="`${percentOf(overview.automatic.approved, overview.automatic.total)}%`"
                />
                <AdminStatTile
                    :label="$t('admin_status_pending_review')"
                    icon="mdi:clock-outline"
                    :value="overview.automatic.pendingReview"
                    :hint="$t('admin_failures', { count: overview.automatic.failed })"
                />
                <AdminStatTile
                    :label="$t('admin_rejected_plural')"
                    icon="mdi:close-circle-outline"
                    :value="overview.automatic.rejected"
                    :hint="`${percentOf(overview.automatic.rejected, overview.automatic.total)}%`"
                />
                <AdminStatTile
                    :label="$t('admin_latency')"
                    icon="mdi:timer-outline"
                    :value="
                        overview.automatic.averageLatencyMs === null
                            ? '—'
                            : `${(overview.automatic.averageLatencyMs / 1000).toFixed(1)} s`
                    "
                    :hint="$t('admin_latency_hint')"
                />
            </section>

            <section class="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div class="surface p-5">
                    <h2 class="mb-4 text-lg sm:text-lg">{{ $t('admin_decisions_per_day') }}</h2>
                    <AdminDailyChart :rows="overview.daily" :series="series" :label="$t('admin_decisions_per_day')" />
                </div>

                <div class="surface space-y-4 p-5">
                    <h2 class="text-lg sm:text-lg">{{ $t('admin_moderator_setup') }}</h2>
                    <dl class="space-y-3 text-sm">
                        <div>
                            <dt class="text-muted">{{ $t('admin_model') }}</dt>
                            <dd class="font-bold">{{ overview.moderator.model ?? $t('admin_not_configured') }}</dd>
                        </div>
                        <div v-for="rule in thresholds" :key="rule.label">
                            <dt class="text-muted">{{ $t(rule.label) }}</dt>
                            <dd>
                                <ul class="list-inside list-disc">
                                    <li v-for="value in rule.values" :key="value">{{ value }}</li>
                                </ul>
                            </dd>
                        </div>
                    </dl>

                    <h2 class="pt-2 text-lg sm:text-lg">{{ $t('admin_admin_decisions') }}</h2>
                    <dl class="grid grid-cols-3 gap-2 text-sm">
                        <div>
                            <dt class="text-muted">{{ $t('admin_published') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ overview.admin.approved }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">{{ $t('admin_hidden') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ overview.admin.pendingReview }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">{{ $t('admin_rejected_plural') }}</dt>
                            <dd class="text-xl font-extrabold tabular-nums">{{ overview.admin.rejected }}</dd>
                        </div>
                    </dl>
                    <NuxtLink to="/admin/mascotas?estado=pending_review" class="btn btn-primary btn-sm w-full">
                        {{ $t('admin_review_queue', { count: overview.pendingReview }) }}
                    </NuxtLink>
                </div>
            </section>

            <section class="surface p-5">
                <h2 class="mb-4 text-lg sm:text-lg">{{ $t('admin_recent_decisions') }}</h2>
                <p v-if="!overview.recent.length" class="text-sm text-muted">{{ $t('admin_no_decisions') }}</p>
                <div v-else class="overflow-x-auto">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th scope="col">{{ $t('admin_when') }}</th>
                                <th scope="col">{{ $t('admin_decision') }}</th>
                                <th scope="col">{{ $t('admin_report') }}</th>
                                <th scope="col" class="text-right">{{ $t('admin_score_is_pet_report') }}</th>
                                <th scope="col" class="text-right">{{ $t('admin_score_shows_animal') }}</th>
                                <th scope="col" class="text-right">{{ $t('admin_score_inappropriate') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="decision in overview.recent" :key="decision.id">
                                <td class="whitespace-nowrap text-muted">
                                    {{ dateTime.format(new Date(decision.decidedAt)) }}
                                </td>
                                <td>
                                    <div class="flex flex-col items-start gap-1">
                                        <AdminModerationBadge :status="decision.decision" />
                                        <span class="flex items-center gap-1 text-xs text-muted">
                                            <Icon
                                                :name="
                                                    decision.source === 'admin' ? 'mdi:account' : 'mdi:robot-outline'
                                                "
                                                aria-hidden="true"
                                            />
                                            {{
                                                decision.source === 'admin'
                                                    ? $t('admin_by_admin')
                                                    : $t('admin_by_moderator')
                                            }}
                                        </span>
                                        <span
                                            v-if="decision.error"
                                            class="max-w-48 truncate text-xs text-lost"
                                            :title="decision.error"
                                        >
                                            {{ $t('admin_moderator_failed') }}: {{ decision.error }}
                                        </span>
                                    </div>
                                </td>
                                <td class="max-w-xs">
                                    <NuxtLink
                                        v-if="decision.petId && decision.decision !== 'rejected'"
                                        :to="`/admin/mascotas/${decision.petId}`"
                                        class="link line-clamp-2"
                                    >
                                        {{ describe(decision) }}
                                    </NuxtLink>
                                    <span v-else class="line-clamp-2" :title="decision.submission?.description">{{
                                        describe(decision)
                                    }}</span>
                                    <span v-if="decision.submission" class="text-xs text-muted">
                                        {{ $t(decision.submission.species) }} · {{ decision.submission.location }}
                                    </span>
                                </td>
                                <td class="text-right tabular-nums">
                                    {{ formatProbability(decision.scores?.isPetReport) }}
                                </td>
                                <td class="text-right tabular-nums">
                                    {{ formatProbability(decision.scores?.showsAnimal) }}
                                </td>
                                <td class="text-right tabular-nums">
                                    {{ formatProbability(decision.scores?.inappropriate) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </template>
    </div>
</template>
