import type { Clock, IdGenerator } from '../../shared/application/ports'
import type { ContentModerator, ImageStorage, PetDescriber, PetRepository } from './application/ports'
import {
    AuthorizeImageUpload,
    CleanUpOrphanImages,
    DeletePet,
    DescribePetFromImage,
    type ErrorReporter,
    GetPet,
    ListPets,
    ListPetsForModeration,
    MarkPetAsReunited,
    ModeratePet,
    ReportPet
} from './application/useCases'
import { DEFAULT_MODERATION_THRESHOLDS, type ModerationThresholds } from './domain/moderation'

export interface PetsModuleDependencies {
    pets: PetRepository
    images: ImageStorage
    describer: PetDescriber
    moderator: ContentModerator
    moderationThresholds?: ModerationThresholds
    clock: Clock
    ids: IdGenerator
    reportError?: ErrorReporter
}

/** Public entry point of the pets module: its use cases, wired to whatever adapters the caller provides. */
export function createPetsModule({
    pets,
    images,
    describer,
    moderator,
    moderationThresholds = DEFAULT_MODERATION_THRESHOLDS,
    clock,
    ids,
    reportError = () => {}
}: PetsModuleDependencies) {
    return {
        report: new ReportPet(pets, images, moderator, moderationThresholds, clock, ids, reportError),
        list: new ListPets(pets),
        listForModeration: new ListPetsForModeration(pets),
        get: new GetPet(pets),
        markAsReunited: new MarkPetAsReunited(pets, clock),
        moderate: new ModeratePet(pets, images, clock, reportError),
        delete: new DeletePet(pets, images, reportError),
        describe: new DescribePetFromImage(describer),
        authorizeImageUpload: new AuthorizeImageUpload(images),
        cleanUpOrphanImages: new CleanUpOrphanImages(pets, images, clock)
    }
}

export type PetsModule = ReturnType<typeof createPetsModule>
