import { z } from 'zod'

const required = (name: string) => z.string({ required_error: `${name} is not set` }).min(1, `${name} is not set`)
const optional = () =>
    z
        .string()
        .optional()
        .transform(value => value || undefined)

const configSchema = z.object({
    databaseUrl: required('NUXT_DATABASE_URL'),
    /** Optional: without it, admin-only actions are disabled. */
    adminToken: optional(),
    /** Optional: secret for internal endpoints called by schedulers. Without it they are disabled. */
    internalToken: optional(),
    /** Secret Vercel Cron sends as a bearer token (CRON_SECRET), accepted on internal endpoints. */
    cronSecret: optional(),
    cloudinary: z.object({
        cloudName: required('NUXT_CLOUDINARY_CLOUD_NAME'),
        apiKey: required('NUXT_CLOUDINARY_API_KEY'),
        apiSecret: required('NUXT_CLOUDINARY_API_SECRET'),
        folder: z.string().min(1).default('pets')
    }),
    openai: z.object({
        /** Optional: without it, image analysis is off and reports skip automatic moderation (see the container). */
        apiKey: optional(),
        describerModel: z.string().min(1).default('gpt-4o-mini'),
        moderationModel: z.string().min(1).default('gpt-6-luna')
    }),
    gemini: z
        .object({
            /** Optional: without it, image search answers 503 and nothing is indexed. */
            apiKey: optional(),
            embeddingModel: z.string().min(1).default('gemini-embedding-2-preview')
        })
        .default({}),
    imageSearch: z
        .object({
            /** Similarity calibration from scripts/eval-embeddings.ts. */
            matchFloor: z.coerce.number().min(-1).max(1).default(0.6),
            matchCeiling: z.coerce.number().min(-1).max(1).default(0.95)
        })
        .default({})
        .refine(c => c.matchCeiling > c.matchFloor, 'matchCeiling must be greater than matchFloor'),
    semanticSearch: z
        .object({
            /** Calibration of text queries against report texts and against photos. */
            textFloor: z.coerce.number().min(-1).max(1).default(0.55),
            textCeiling: z.coerce.number().min(-1).max(1).default(0.85),
            imageFloor: z.coerce.number().min(-1).max(1).default(0.25),
            imageCeiling: z.coerce.number().min(-1).max(1).default(0.45)
        })
        .default({})
        .refine(
            c => c.textCeiling > c.textFloor && c.imageCeiling > c.imageFloor,
            'semantic search ceilings must be greater than their floors'
        ),
    upstash: z
        .object({
            /** Optional: without both values, rate limiting is disabled. */
            url: optional(),
            token: optional()
        })
        .default({})
})

export type ServerConfig = z.infer<typeof configSchema>

/** Validates the runtime config once, failing fast with every missing variable listed. */
export function parseServerConfig(raw: unknown): ServerConfig {
    const result = configSchema.safeParse(raw)
    if (!result.success) {
        const problems = result.error.issues.map(issue => `- ${issue.message} (${issue.path.join('.')})`)
        throw new Error(`Invalid server configuration:\n${problems.join('\n')}`)
    }
    return result.data
}
