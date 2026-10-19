import type { Clock, IdGenerator } from '../../shared/application/ports'
import type { ImageStorage, PetDescriber, PetRepository } from './application/ports'
import {
    AuthorizeImageUpload,
    DeletePet,
    DescribePetFromImage,
    GetPet,
    ListPets,
    MarkPetAsReunited,
    ReportPet
} from './application/useCases'

export interface PetsModuleDependencies {
    pets: PetRepository
    images: ImageStorage
    describer: PetDescriber
    clock: Clock
    ids: IdGenerator
}

/** Public entry point of the pets module: its use cases, wired to whatever adapters the caller provides. */
export function createPetsModule({ pets, images, describer, clock, ids }: PetsModuleDependencies) {
    return {
        report: new ReportPet(pets, images, clock, ids),
        list: new ListPets(pets),
        get: new GetPet(pets),
        markAsReunited: new MarkPetAsReunited(pets, clock),
        delete: new DeletePet(pets),
        describe: new DescribePetFromImage(describer),
        authorizeImageUpload: new AuthorizeImageUpload(images)
    }
}

export type PetsModule = ReturnType<typeof createPetsModule>
