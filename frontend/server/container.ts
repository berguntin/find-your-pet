/**
 * Composition root: the only place that knows which adapter implements each port.
 * Built lazily on the first request so a missing variable fails loudly at runtime, not at build time.
 */
import { randomUUID } from 'node:crypto'
import { consola } from 'consola'
import { useRuntimeConfig } from '#imports'
import { EventHandlerRegistry, ProcessOutbox } from './shared/application/outbox'
import type { RateLimiter } from './shared/application/rateLimit'
import { parseServerConfig, type ServerConfig } from './shared/infrastructure/config'
import { runInBackground } from './shared/infrastructure/background'
import { createDatabase } from './shared/infrastructure/database'
import { PostgresOutboxStore } from './shared/infrastructure/PostgresOutboxStore'
import { NoopRateLimiter, UpstashRateLimiter } from './shared/infrastructure/rateLimiters'
import { createPetsModule, type PetsModule } from './modules/pets'
import { CloudinaryImageStorage } from './modules/pets/infrastructure/CloudinaryImageStorage'
import {
    DisabledContentModerator,
    OpenAIDecisionsModerator
} from './modules/pets/infrastructure/OpenAIDecisionsModerator'
import {
    createOpenAIClient,
    DisabledPetDescriber,
    OpenAIPetDescriber
} from './modules/pets/infrastructure/OpenAIPetDescriber'
import { PostgresPetRepository } from './modules/pets/infrastructure/PostgresPetRepository'

export interface Container {
    config: Pick<ServerConfig, 'adminToken' | 'internalToken' | 'cronSecret'>
    rateLimiter: RateLimiter
    processOutbox: ProcessOutbox
    pets: PetsModule
}

function buildContainer(): Container {
    const runtimeConfig = useRuntimeConfig()
    const config = parseServerConfig({
        ...runtimeConfig,
        cronSecret: process.env.CRON_SECRET,
        // Also accept the variable names the Upstash integration for Vercel creates.
        upstash: {
            url: runtimeConfig.upstash.url || process.env.UPSTASH_REDIS_REST_URL,
            token: runtimeConfig.upstash.token || process.env.UPSTASH_REDIS_REST_TOKEN
        }
    })

    const clock = { now: () => new Date() }
    const sql = createDatabase(config.databaseUrl)
    const openai = config.openai.apiKey ? createOpenAIClient(config.openai.apiKey) : null
    const reportError = (error: unknown, context: string) => consola.error(`[${context}]`, error)

    const isDevelopment = process.env.NODE_ENV === 'development'
    if (!openai) {
        consola.warn(
            isDevelopment
                ? 'NUXT_OPENAI_API_KEY is not set: reports are published without moderation (development only)'
                : 'NUXT_OPENAI_API_KEY is not set: every report goes to manual review'
        )
    }
    if (!config.upstash.url || !config.upstash.token) consola.warn('Upstash is not configured: rate limiting is off')

    // Modules subscribe their handlers here (image indexing, notifications...).
    const eventHandlers = new EventHandlerRegistry()

    return {
        config,
        rateLimiter:
            config.upstash.url && config.upstash.token
                ? new UpstashRateLimiter({ url: config.upstash.url, token: config.upstash.token })
                : new NoopRateLimiter(),
        processOutbox: new ProcessOutbox(new PostgresOutboxStore(sql), eventHandlers, clock),
        pets: createPetsModule({
            pets: new PostgresPetRepository(sql),
            images: new CloudinaryImageStorage(config.cloudinary, clock),
            describer: openai
                ? new OpenAIPetDescriber(openai, config.openai.describerModel)
                : new DisabledPetDescriber(),
            moderator: openai
                ? new OpenAIDecisionsModerator(openai, config.openai.moderationModel)
                : new DisabledContentModerator(isDevelopment),
            clock,
            ids: { next: () => randomUUID() },
            reportError
        })
    }
}

let container: Container | undefined

export function useContainer(): Container {
    container ??= buildContainer()
    return container
}

/** Delivers the events a request just stored, after the response; scheduled runs retry what fails. */
export function processOutboxInBackground(): void {
    const { processOutbox } = useContainer()
    runInBackground(() => processOutbox.execute(), 'process-outbox')
}
