import { z } from 'zod'

// Nuxt parses NUXT_* values, so an all-digit secret (like a Cloudinary API key) can arrive as a number.
const text = (name: string) =>
    z.union([z.string(), z.number()], { required_error: `${name} is not set` }).transform(value => String(value))
const required = (name: string) => text(name).pipe(z.string().min(1, `${name} is not set`))
const optional = () =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform(value => (value === undefined || value === '' ? undefined : String(value)))

/**
 * Secrets and identifiers read exactly as written in the environment. Nuxt's runtime config parses
 * NUXT_* values: digits become numbers, which loses precision past 2^53 and would corrupt long tokens.
 * Values not set in the environment keep the runtime config ones.
 */
type Section = Record<string, unknown>
type RuntimeConfigInput = Record<string, unknown> & {
    cloudinary?: Section
    openai?: Section
    gemini?: Section
    upstash?: Section
    facebook?: Section
    public?: Section
}

export function withRawSecrets(
    runtimeConfig: RuntimeConfigInput,
    env: Record<string, string | undefined>
): Record<string, unknown> {
    const raw = (name: string, fallback: unknown) => env[name] ?? fallback
    return {
        ...runtimeConfig,
        databaseUrl: raw('NUXT_DATABASE_URL', runtimeConfig.databaseUrl),
        adminToken: raw('NUXT_ADMIN_TOKEN', runtimeConfig.adminToken),
        internalToken: raw('NUXT_INTERNAL_TOKEN', runtimeConfig.internalToken),
        cronSecret: env.CRON_SECRET,
        baseUrl: runtimeConfig.public?.baseUrl,
        cloudinary: {
            ...runtimeConfig.cloudinary,
            cloudName: raw('NUXT_CLOUDINARY_CLOUD_NAME', runtimeConfig.cloudinary?.cloudName),
            apiKey: raw('NUXT_CLOUDINARY_API_KEY', runtimeConfig.cloudinary?.apiKey),
            apiSecret: raw('NUXT_CLOUDINARY_API_SECRET', runtimeConfig.cloudinary?.apiSecret)
        },
        openai: {
            ...runtimeConfig.openai,
            apiKey: raw('NUXT_OPENAI_API_KEY', runtimeConfig.openai?.apiKey)
        },
        gemini: {
            ...runtimeConfig.gemini,
            apiKey: raw('NUXT_GEMINI_API_KEY', runtimeConfig.gemini?.apiKey)
        },
        // A Page id has more digits than a JS number can hold exactly.
        facebook: {
            ...runtimeConfig.facebook,
            pageId: raw('NUXT_FACEBOOK_PAGE_ID', runtimeConfig.facebook?.pageId),
            pageToken: raw('NUXT_FACEBOOK_PAGE_TOKEN', runtimeConfig.facebook?.pageToken)
        },
        // Also accept the variable names the Upstash integration for Vercel creates.
        upstash: {
            url: raw('NUXT_UPSTASH_URL', runtimeConfig.upstash?.url) || env.UPSTASH_REDIS_REST_URL,
            token: raw('NUXT_UPSTASH_TOKEN', runtimeConfig.upstash?.token) || env.UPSTASH_REDIS_REST_TOKEN
        }
    }
}

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
        .default({}),
    facebook: z
        .object({
            /** Optional: without both values, pets are not announced on our Facebook Page. */
            pageId: optional(),
            pageToken: optional(),
            graphVersion: z
                .string()
                .regex(/^v\d+\.\d+$/, 'graphVersion must look like v24.0')
                .default('v24.0')
        })
        .default({}),
    /** Public URL of the site, for links to pet pages in social posts. */
    baseUrl: z.string().url().default('http://localhost:8000')
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
