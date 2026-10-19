import { z } from 'zod'

const required = (name: string) => z.string({ required_error: `${name} is not set` }).min(1, `${name} is not set`)

const configSchema = z.object({
    databaseUrl: required('NUXT_DATABASE_URL'),
    /** Optional: without it, admin-only actions are disabled. */
    adminToken: z.string().optional(),
    cloudinary: z.object({
        cloudName: required('NUXT_CLOUDINARY_CLOUD_NAME'),
        apiKey: required('NUXT_CLOUDINARY_API_KEY'),
        apiSecret: required('NUXT_CLOUDINARY_API_SECRET'),
        folder: z.string().min(1).default('pets')
    }),
    openai: z.object({
        /** Optional: without it, image analysis is disabled and the form is filled by hand. */
        apiKey: z.string().optional(),
        describerModel: z.string().min(1).default('gpt-4o-mini')
    })
})

export type ServerConfig = z.infer<typeof configSchema>

/** Validates the runtime config once, failing fast with every missing variable listed. */
export function parseServerConfig(raw: unknown): ServerConfig {
    const result = configSchema.safeParse(raw)
    if (!result.success) {
        const problems = result.error.issues.map(issue => `- ${issue.message} (${issue.path.join('.')})`)
        throw new Error(`Invalid server configuration:\n${problems.join('\n')}`)
    }
    const config = result.data
    return {
        ...config,
        adminToken: config.adminToken || undefined,
        openai: { ...config.openai, apiKey: config.openai.apiKey || undefined }
    }
}
