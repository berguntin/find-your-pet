/**
 * Probabilities (0..1) returned by the content moderator for a report.
 * `null` means the moderator declined to answer that question.
 */
export interface ModerationScores {
    isPetReport: number | null
    showsAnimal: number | null
    inappropriate: number | null
}

export type ModerationDecision = 'approved' | 'pending_review' | 'rejected'

export interface ModerationThresholds {
    /** Minimum probability of being a pet report to publish it automatically. */
    approveIsPetReport: number
    /** Minimum probability of the images showing an animal or a pet poster to publish automatically. */
    approveShowsAnimal: number
    /** Maximum probability of inappropriate content to publish automatically. */
    approveInappropriate: number
    /** Below this probability of being a pet report, the report is rejected. */
    rejectIsPetReport: number
    /** From this probability of inappropriate content, the report is rejected. */
    rejectInappropriate: number
}

export const DEFAULT_MODERATION_THRESHOLDS: ModerationThresholds = {
    approveIsPetReport: 0.8,
    approveShowsAnimal: 0.5,
    approveInappropriate: 0.2,
    rejectIsPetReport: 0.3,
    rejectInappropriate: 0.7
}

/**
 * Turns moderation scores into a decision. Anything uncertain (middle scores, refusals,
 * or the moderator being unavailable) goes to manual review instead of being rejected.
 */
export function decideModeration(
    scores: ModerationScores | null,
    thresholds: ModerationThresholds = DEFAULT_MODERATION_THRESHOLDS
): ModerationDecision {
    if (!scores) return 'pending_review'
    const { isPetReport, showsAnimal, inappropriate } = scores

    if (inappropriate !== null && inappropriate >= thresholds.rejectInappropriate) return 'rejected'
    if (isPetReport !== null && isPetReport < thresholds.rejectIsPetReport) return 'rejected'

    const confident =
        isPetReport !== null &&
        showsAnimal !== null &&
        inappropriate !== null &&
        isPetReport >= thresholds.approveIsPetReport &&
        showsAnimal >= thresholds.approveShowsAnimal &&
        inappropriate < thresholds.approveInappropriate

    return confident ? 'approved' : 'pending_review'
}
