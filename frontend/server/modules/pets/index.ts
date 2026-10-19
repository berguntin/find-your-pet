import type { Clock, IdGenerator } from '../../shared/application/ports'
import {
    IndexPetForSearch,
    SearchPets,
    SearchPetsByImage,
    SearchPetsByText,
    type SemanticSearchCalibration
} from './application/search'
import type {
    ContentModerator,
    Embedder,
    ImageStorage,
    PetDescriber,
    PetEmbeddingIndex,
    PetRepository
} from './application/ports'
import {
    AuthorizeImageUpload,
    CleanUpOrphanImages,
    DeletePet,
    DescribePetFromImage,
    type ErrorReporter,
    GetPet,
    ListPetsForModeration,
    MarkPetAsReunited,
    ModeratePet,
    ReportPet
} from './application/useCases'
import { DEFAULT_MATCH_CALIBRATION, DEFAULT_SEMANTIC_CALIBRATION, type MatchCalibration } from './domain/matchScore'
import { DEFAULT_MODERATION_THRESHOLDS, type ModerationThresholds } from './domain/moderation'

export interface PetsModuleDependencies {
    pets: PetRepository
    images: ImageStorage
    describer: PetDescriber
    moderator: ContentModerator
    moderationThresholds?: ModerationThresholds
    embedder: Embedder
    embeddingIndex: PetEmbeddingIndex
    matchCalibration?: MatchCalibration
    semanticCalibration?: SemanticSearchCalibration
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
    embedder,
    embeddingIndex,
    matchCalibration = DEFAULT_MATCH_CALIBRATION,
    semanticCalibration = DEFAULT_SEMANTIC_CALIBRATION,
    clock,
    ids,
    reportError = () => {}
}: PetsModuleDependencies) {
    const searchByText = new SearchPetsByText(pets, embedder, embeddingIndex, semanticCalibration)
    return {
        report: new ReportPet(pets, images, moderator, moderationThresholds, clock, ids, reportError),
        search: new SearchPets(pets, searchByText, reportError),
        searchByText,
        listForModeration: new ListPetsForModeration(pets),
        get: new GetPet(pets),
        markAsReunited: new MarkPetAsReunited(pets, clock),
        moderate: new ModeratePet(pets, images, clock, reportError),
        delete: new DeletePet(pets, images, reportError),
        describe: new DescribePetFromImage(describer),
        authorizeImageUpload: new AuthorizeImageUpload(images),
        cleanUpOrphanImages: new CleanUpOrphanImages(pets, images, clock),
        indexForSearch: new IndexPetForSearch(pets, images, embedder, embeddingIndex),
        searchByImage: new SearchPetsByImage(pets, embedder, embeddingIndex, matchCalibration)
    }
}

/** Events the pets module reacts to, for the outbox registry. */
export function petsEventHandlers(module: PetsModule) {
    const petId = (payload: Record<string, unknown>) => {
        if (typeof payload.petId !== 'string') throw new Error('Event without petId')
        return payload.petId
    }
    return {
        'pet.published': async (event: { payload: Record<string, unknown> }) =>
            module.indexForSearch.execute(petId(event.payload))
    }
}

export type PetsModule = ReturnType<typeof createPetsModule>
