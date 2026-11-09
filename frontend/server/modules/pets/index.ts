import type { Clock, IdGenerator } from '../../shared/application/ports'
import {
    BackfillSearchIndex,
    IndexPetForSearch,
    SearchPets,
    SearchPetsByImage,
    SearchPetsByText,
    type SemanticSearchCalibration
} from './application/search'
import { SharedImageGuard } from './application/sharedImages'
import { GetModerationOverview, GetPetStats } from './application/stats'
import {
    DeleteSighting,
    HideSighting,
    ListSightings,
    ListSightingsForModeration,
    ModerateSighting,
    ReportSighting,
    ValidateSighting
} from './application/sightings'
import type {
    AuthorDirectory,
    ContentModerator,
    Embedder,
    ImageStorage,
    ModerationLog,
    PetDescriber,
    PetEmbeddingIndex,
    PetRepository,
    SightingRepository
} from './application/ports'
import {
    AuthorizeImageUpload,
    CleanUpOrphanImages,
    DeletePet,
    DeletePetsOfOwner,
    DescribePetFromImage,
    type ErrorReporter,
    GetPet,
    ListPetsForModeration,
    MarkPetAsReunited,
    ModeratePet,
    ReportPet,
    UpdatePet
} from './application/useCases'
import { DEFAULT_MATCH_CALIBRATION, DEFAULT_SEMANTIC_CALIBRATION, type MatchCalibration } from './domain/matchScore'
import { DEFAULT_MODERATION_THRESHOLDS, type ModerationThresholds } from './domain/moderation'

export interface PetsModuleDependencies {
    pets: PetRepository
    sightings: SightingRepository
    authors: AuthorDirectory
    images: ImageStorage
    describer: PetDescriber
    moderator: ContentModerator
    moderationThresholds?: ModerationThresholds
    moderationLog: ModerationLog
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
    sightings,
    authors,
    images: storage,
    describer,
    moderator,
    moderationThresholds = DEFAULT_MODERATION_THRESHOLDS,
    moderationLog,
    embedder,
    embeddingIndex,
    matchCalibration = DEFAULT_MATCH_CALIBRATION,
    semanticCalibration = DEFAULT_SEMANTIC_CALIBRATION,
    clock,
    ids,
    reportError = () => {}
}: PetsModuleDependencies) {
    // Every use case that deletes images goes through the guard; only the orphan cleanup uses the raw storage.
    const images = new SharedImageGuard(storage, pets, sightings)
    const searchByText = new SearchPetsByText(pets, embedder, embeddingIndex, semanticCalibration)
    const indexForSearch = new IndexPetForSearch(pets, images, embedder, embeddingIndex)
    return {
        report: new ReportPet(pets, images, moderator, moderationThresholds, moderationLog, clock, ids, reportError),
        search: new SearchPets(pets, searchByText, reportError),
        searchByText,
        listForModeration: new ListPetsForModeration(pets),
        get: new GetPet(pets),
        markAsReunited: new MarkPetAsReunited(pets, clock),
        moderate: new ModeratePet(pets, images, moderationLog, clock, ids, reportError),
        update: new UpdatePet(pets, images, clock, reportError),
        stats: new GetPetStats(pets, clock),
        moderationOverview: new GetModerationOverview(moderationLog, pets, moderator, moderationThresholds, clock),
        delete: new DeletePet(pets, images, reportError),
        deleteAllOfOwner: new DeletePetsOfOwner(pets, images, reportError),
        describe: new DescribePetFromImage(describer),
        authorizeImageUpload: new AuthorizeImageUpload(images),
        cleanUpOrphanImages: new CleanUpOrphanImages(pets, sightings, storage, clock),
        reportSighting: new ReportSighting(
            pets,
            sightings,
            images,
            moderator,
            moderationThresholds,
            moderationLog,
            clock,
            ids,
            reportError
        ),
        listSightings: new ListSightings(pets, sightings, authors),
        validateSighting: new ValidateSighting(pets, sightings, clock),
        hideSighting: new HideSighting(pets, sightings, clock),
        deleteSighting: new DeleteSighting(sightings, images, moderationLog, reportError),
        listSightingsForModeration: new ListSightingsForModeration(sightings),
        moderateSighting: new ModerateSighting(sightings, images, moderationLog, clock, ids, reportError),
        indexForSearch,
        backfillSearchIndex: new BackfillSearchIndex(pets, embedder, embeddingIndex, indexForSearch, reportError),
        searchByImage: new SearchPetsByImage(pets, embedder, embeddingIndex, matchCalibration)
    }
}

/** Events the pets module reacts to, for the outbox registry. */
export function petsEventHandlers(module: PetsModule) {
    const petId = (payload: Record<string, unknown>) => {
        if (typeof payload.petId !== 'string') throw new Error('Event without petId')
        return payload.petId
    }
    // Indexing is idempotent and removes pets that are no longer public, so it serves all three.
    const reindex = async (event: { payload: Record<string, unknown> }) =>
        module.indexForSearch.execute(petId(event.payload))
    return {
        'pet.published': reindex,
        'pet.edited': reindex,
        'pet.unpublished': reindex
    }
}

export type PetsModule = ReturnType<typeof createPetsModule>
