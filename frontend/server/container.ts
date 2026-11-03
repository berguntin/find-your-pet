/**
 * Composition root: the only place that knows which adapter implements each port.
 * Built lazily on the first request so a missing variable fails loudly at runtime, not at build time.
 */
import { randomUUID } from 'node:crypto'
import { consola } from 'consola'
import { useRuntimeConfig } from '#imports'
import { EventHandlerRegistry, ProcessOutbox } from './shared/application/outbox'
import type { RateLimiter } from './shared/application/rateLimit'
import { parseServerConfig, withRawSecrets, type ServerConfig } from './shared/infrastructure/config'
import { runInBackground } from './shared/infrastructure/background'
import { createDatabase } from './shared/infrastructure/database'
import type { AdminAccess } from './shared/infrastructure/http'
import { PostgresOutboxStore } from './shared/infrastructure/PostgresOutboxStore'
import { NoopRateLimiter, UpstashRateLimiter } from './shared/infrastructure/rateLimiters'
import { GoogleGenAI } from '@google/genai'
import { createPetsModule, petsEventHandlers, type PetsModule } from './modules/pets'
import { CloudinaryImageStorage } from './modules/pets/infrastructure/CloudinaryImageStorage'
import { GeminiEmbedder, UnavailableEmbedder } from './modules/pets/infrastructure/GeminiEmbedder'
import {
    DisabledContentModerator,
    OpenAIDecisionsModerator
} from './modules/pets/infrastructure/OpenAIDecisionsModerator'
import {
    createOpenAIClient,
    DisabledPetDescriber,
    OpenAIPetDescriber
} from './modules/pets/infrastructure/OpenAIPetDescriber'
import { PostgresModerationLog } from './modules/pets/infrastructure/PostgresModerationLog'
import { PostgresPetEmbeddingIndex } from './modules/pets/infrastructure/PostgresPetEmbeddingIndex'
import { PostgresPetRepository } from './modules/pets/infrastructure/PostgresPetRepository'

export interface Container {
    config: Pick<ServerConfig, 'internalToken' | 'cronSecret'>
    adminAccess: AdminAccess
    rateLimiter: RateLimiter
    processOutbox: ProcessOutbox
    pets: PetsModule
}

function buildContainer(): Container {
    const config = parseServerConfig(withRawSecrets(useRuntimeConfig(), process.env))

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
    if (!config.gemini.apiKey)
        consola.warn('NUXT_GEMINI_API_KEY is not set: image search is off and text search uses keywords only')

    const pets = createPetsModule({
        pets: new PostgresPetRepository(sql),
        images: new CloudinaryImageStorage(config.cloudinary, clock),
        describer: openai ? new OpenAIPetDescriber(openai, config.openai.describerModel) : new DisabledPetDescriber(),
        moderator: openai
            ? new OpenAIDecisionsModerator(openai, config.openai.moderationModel)
            : new DisabledContentModerator(isDevelopment),
        moderationLog: new PostgresModerationLog(sql),
        embedder: config.gemini.apiKey
            ? new GeminiEmbedder(new GoogleGenAI({ apiKey: config.gemini.apiKey }), config.gemini.embeddingModel)
            : new UnavailableEmbedder(),
        embeddingIndex: new PostgresPetEmbeddingIndex(sql),
        matchCalibration: { floor: config.imageSearch.matchFloor, ceiling: config.imageSearch.matchCeiling },
        semanticCalibration: {
            text: { floor: config.semanticSearch.textFloor, ceiling: config.semanticSearch.textCeiling },
            image: { floor: config.semanticSearch.imageFloor, ceiling: config.semanticSearch.imageCeiling }
        },
        clock,
        ids: { next: () => randomUUID() },
        reportError
    })

    // Modules subscribe their handlers here (image indexing now; notifications later).
    const eventHandlers = new EventHandlerRegistry()
    if (config.gemini.apiKey) {
        for (const [type, handler] of Object.entries(petsEventHandlers(pets))) eventHandlers.on(type, handler)
    }

    if (config.adminEmails.length === 0)
        consola.warn('NUXT_ADMIN_EMAILS is not set: nobody can sign in to the admin panel')

    return {
        config,
        adminAccess: {
            adminToken: config.adminToken,
            adminEmails: config.adminEmails,
            // getUserSession is a Nitro auto-import from nuxt-auth-utils (not exposed through #imports).
            sessionEmail: async event => (await getUserSession(event)).user?.email ?? null
        },
        rateLimiter:
            config.upstash.url && config.upstash.token
                ? new UpstashRateLimiter({ url: config.upstash.url, token: config.upstash.token })
                : new NoopRateLimiter(),
        processOutbox: new ProcessOutbox(new PostgresOutboxStore(sql), eventHandlers, clock),
        pets
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
