/**
 * Metrics for the embedding evaluation: how well a model finds the same animal among others,
 * and which similarity values separate "same animal" from "different animal".
 */
export interface LabeledVector {
    animalId: string
    photo: string
    vector: number[]
}

export interface Distribution {
    count: number
    min: number
    p5: number
    median: number
    p95: number
    max: number
}

export interface EvaluationReport {
    animals: number
    photos: number
    /** Animals with at least two photos: each is searched once with its first photo. */
    queries: number
    recallAt1: number
    recallAt5: number
    sameAnimal: Distribution
    differentAnimal: Distribution
    /** Null when the model does not separate same and different animals well enough. */
    suggestedCalibration: { floor: number; ceiling: number } | null
}

export function cosine(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!
        normA += a[i]! * a[i]!
        normB += b[i]! * b[i]!
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return Number.NaN
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
    return sorted[index]!
}

export function distribution(values: number[]): Distribution {
    const sorted = [...values].sort((a, b) => a - b)
    return {
        count: sorted.length,
        min: sorted[0] ?? Number.NaN,
        p5: percentile(sorted, 5),
        median: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        max: sorted.at(-1) ?? Number.NaN
    }
}

export function evaluate(items: LabeledVector[]): EvaluationReport {
    const byAnimal = new Map<string, LabeledVector[]>()
    for (const item of items) byAnimal.set(item.animalId, [...(byAnimal.get(item.animalId) ?? []), item])

    // Retrieval, as the app does it: best image per animal, animals ranked by that similarity.
    let queries = 0
    let hitsAt1 = 0
    let hitsAt5 = 0
    for (const [animalId, photos] of byAnimal) {
        if (photos.length < 2) continue
        queries++
        const query = photos[0]!
        const bestPerAnimal = new Map<string, number>()
        for (const candidate of items) {
            if (candidate === query) continue
            const similarity = cosine(query.vector, candidate.vector)
            bestPerAnimal.set(
                candidate.animalId,
                Math.max(bestPerAnimal.get(candidate.animalId) ?? -Infinity, similarity)
            )
        }
        const ranking = [...bestPerAnimal].sort((a, b) => b[1] - a[1]).map(([id]) => id)
        const rank = ranking.indexOf(animalId)
        if (rank === 0) hitsAt1++
        if (rank >= 0 && rank < 5) hitsAt5++
    }

    const same: number[] = []
    const different: number[] = []
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const similarity = cosine(items[i]!.vector, items[j]!.vector)
            ;(items[i]!.animalId === items[j]!.animalId ? same : different).push(similarity)
        }
    }

    const sameAnimal = distribution(same)
    const differentAnimal = distribution(different)
    // Hide almost every different animal (95th percentile) and show typical same-animal pairs as 100%.
    const floor = differentAnimal.p95
    const ceiling = sameAnimal.median

    return {
        animals: byAnimal.size,
        photos: items.length,
        queries,
        recallAt1: queries ? hitsAt1 / queries : Number.NaN,
        recallAt5: queries ? hitsAt5 / queries : Number.NaN,
        sameAnimal,
        differentAnimal,
        suggestedCalibration: ceiling > floor ? { floor: round(floor), ceiling: round(ceiling) } : null
    }
}

function round(value: number): number {
    return Math.round(value * 1000) / 1000
}
