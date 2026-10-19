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
