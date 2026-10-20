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
import { PostgresOutboxStore } from './shared/infrastructure/PostgresOutboxStore'
import { NoopRateLimiter, UpstashRateLimiter } from './shared/infrastructure/rateLimiters'
import { GoogleGenAI } from '@google/genai'
import {
    createPetsModule,
    createSocialPublishing,
    petsEventHandlers,
    socialEventHandlers,
    type PetsModule
} from './modules/pets'
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
import { PostgresPetEmbeddingIndex } from './modules/pets/infrastructure/PostgresPetEmbeddingIndex'
import { PostgresPetRepository } from './modules/pets/infrastructure/PostgresPetRepository'
import { FacebookPageSocialPublisher } from './modules/pets/infrastructure/FacebookPageSocialPublisher'
import { PostgresSocialPostRepository } from './modules/pets/infrastructure/PostgresSocialPostRepository'

export interface Container {
    config: Pick<ServerConfig, 'adminToken' | 'internalToken' | 'cronSecret'>
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
    const facebookPage =
        config.facebook.pageId && config.facebook.pageToken
            ? { ...config.facebook, pageId: config.facebook.pageId, pageToken: config.facebook.pageToken }
            : null
    if (!facebookPage) consola.warn('The Facebook Page is not configured: pets are not announced on Facebook')

    const petRepository = new PostgresPetRepository(sql)
    const images = new CloudinaryImageStorage(config.cloudinary, clock)
    const pets = createPetsModule({
        pets: petRepository,
        images,
        describer: openai ? new OpenAIPetDescriber(openai, config.openai.describerModel) : new DisabledPetDescriber(),
        moderator: openai
            ? new OpenAIDecisionsModerator(openai, config.openai.moderationModel)
            : new DisabledContentModerator(isDevelopment),
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

    // Modules subscribe their handlers here (search indexing and social posts now; notifications later).
    const eventHandlers = new EventHandlerRegistry()
    if (config.gemini.apiKey) {
        for (const [type, handler] of Object.entries(petsEventHandlers(pets))) eventHandlers.on(type, handler)
    }
    if (facebookPage) {
        const social = createSocialPublishing({
            pets: petRepository,
            images,
            publisher: new FacebookPageSocialPublisher(facebookPage),
            posts: new PostgresSocialPostRepository(sql),
            petUrl: id => new URL(`/mascota/${id}`, config.baseUrl).toString(),
            clock
        })
        for (const [type, handler] of Object.entries(socialEventHandlers(social))) eventHandlers.on(type, handler)
    }

    return {
        config,
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
