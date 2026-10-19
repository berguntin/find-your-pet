/**
 * Cosine similarity is not a probability. These two points come from the evaluation of the
 * embedding model (scripts/eval-embeddings.ts) and turn similarity into the percentage users see.
 */
export interface MatchCalibration {
    /** Similarity below which two photos are considered different animals: not shown at all. */
    floor: number
    /** Similarity from which two photos are considered the same animal: shown as 100%. */
    ceiling: number
}

/** Placeholder values until the evaluation with real data is run. */
export const DEFAULT_MATCH_CALIBRATION: MatchCalibration = { floor: 0.6, ceiling: 0.95 }

/**
 * Placeholders for text queries, against report texts and against photos. Text-to-photo
 * similarities are usually much lower than same-modality ones, hence the lower values.
 */
export const DEFAULT_SEMANTIC_CALIBRATION = {
    text: { floor: 0.55, ceiling: 0.85 },
    image: { floor: 0.25, ceiling: 0.45 }
} satisfies Record<string, MatchCalibration>

/** Percentage (0–100) shown on a search result, or null when the result should be hidden. */
export function matchPercentage(similarity: number, calibration: MatchCalibration): number | null {
    if (!(calibration.ceiling > calibration.floor)) throw new Error('Invalid match calibration')
    if (similarity < calibration.floor) return null

    const ratio = (similarity - calibration.floor) / (calibration.ceiling - calibration.floor)
    return Math.round(100 * Math.min(1, ratio))
}
