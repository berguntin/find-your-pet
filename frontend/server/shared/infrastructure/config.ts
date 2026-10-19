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
type RuntimeConfigInput = Record<string, unknown> & { cloudinary?: Section; openai?: Section; upstash?: Section }

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
