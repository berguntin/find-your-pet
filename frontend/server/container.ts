/**
 * Composition root: the only place that knows which adapter implements each port.
 * Built lazily on the first request so a missing variable fails loudly at runtime, not at build time.
 */
import { randomUUID } from 'node:crypto'
import { useRuntimeConfig } from '#imports'
import type { Clock, IdGenerator } from './shared/application/ports'
import { parseServerConfig } from './shared/infrastructure/config'
import { createDatabase } from './shared/infrastructure/database'
import {
    AuthorizeImageUpload,
    DeletePet,
    DescribePetFromImage,
    GetPet,
    ListPets,
    MarkPetAsReunited,
    ReportPet
} from './modules/pets/application/useCases'
import { CloudinaryImageStorage } from './modules/pets/infrastructure/CloudinaryImageStorage'
import { DisabledPetDescriber, OpenAIPetDescriber } from './modules/pets/infrastructure/OpenAIPetDescriber'
import { PostgresPetRepository } from './modules/pets/infrastructure/PostgresPetRepository'

function buildContainer() {
    const config = parseServerConfig(useRuntimeConfig())

    const clock: Clock = { now: () => new Date() }
    const ids: IdGenerator = { next: () => randomUUID() }
    const sql = createDatabase(config.databaseUrl)

    const pets = new PostgresPetRepository(sql)
    const images = new CloudinaryImageStorage(config.cloudinary, clock)
    const describer = config.openai.apiKey
        ? new OpenAIPetDescriber(config.openai.apiKey, config.openai.describerModel)
        : new DisabledPetDescriber()

    return {
        config,
        pets: {
            report: new ReportPet(pets, images, clock, ids),
            list: new ListPets(pets),
            get: new GetPet(pets),
            markAsReunited: new MarkPetAsReunited(pets, clock),
            delete: new DeletePet(pets),
            describe: new DescribePetFromImage(describer),
            authorizeImageUpload: new AuthorizeImageUpload(images)
        }
    }
}

export type Container = ReturnType<typeof buildContainer>

let container: Container | undefined

export function useContainer(): Container {
    container ??= buildContainer()
    return container
}
