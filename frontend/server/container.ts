/**
 * Composition root: the only place that knows which adapter implements each port.
 * Built lazily on the first request so a missing variable fails loudly at runtime, not at build time.
 */
import { randomUUID } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import { parseServerConfig, type ServerConfig } from './shared/infrastructure/config'
import { createDatabase } from './shared/infrastructure/database'
import { createPetsModule, type PetsModule } from './modules/pets'
import { CloudinaryImageStorage } from './modules/pets/infrastructure/CloudinaryImageStorage'
import {
    createOpenAIClient,
    DisabledPetDescriber,
    OpenAIPetDescriber
} from './modules/pets/infrastructure/OpenAIPetDescriber'
import { PostgresPetRepository } from './modules/pets/infrastructure/PostgresPetRepository'

export interface Container {
    config: Pick<ServerConfig, 'adminToken'>
    pets: PetsModule
}

function buildContainer(): Container {
    const config = parseServerConfig(useRuntimeConfig())
    const clock = { now: () => new Date() }

    return {
        config,
        pets: createPetsModule({
            pets: new PostgresPetRepository(createDatabase(config.databaseUrl)),
            images: new CloudinaryImageStorage(config.cloudinary, clock),
            describer: config.openai.apiKey
                ? new OpenAIPetDescriber(createOpenAIClient(config.openai.apiKey), config.openai.describerModel)
                : new DisabledPetDescriber(),
            clock,
            ids: { next: () => randomUUID() }
        })
    }
}

let container: Container | undefined

export function useContainer(): Container {
    container ??= buildContainer()
    return container
}
