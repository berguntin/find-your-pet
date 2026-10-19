import type { Actor } from '../../../shared/domain/actor'
import type { Clock, IdGenerator, Page } from '../../../shared/application/ports'
import { NotFoundError, ValidationError } from '../../../shared/domain/errors'
import { Pet, type ReportPetData } from '../domain/Pet'
import type {
    ImageStorage,
    PetDescriber,
    PetDescription,
    PetRepository,
    PetSearchCriteria,
    UploadAuthorization
} from './ports'

export class ReportPet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly clock: Clock,
        private readonly ids: IdGenerator
    ) {}

    async execute(data: ReportPetData, actor: Actor): Promise<Pet> {
        const foreign = data.images.filter(url => !this.images.isManagedUrl(url))
        if (foreign.length > 0) {
            throw new ValidationError('Images must be uploaded through the app', { field: 'images' })
        }

        const pet = Pet.report(data, {
            id: this.ids.next(),
            now: this.clock.now(),
            ownerId: actor.kind === 'user' ? actor.userId : null
        })
        await this.pets.save(pet)
        return pet
    }
}

export class ListPets {
    constructor(private readonly pets: PetRepository) {}

    execute(criteria: PetSearchCriteria): Promise<Page<Pet>> {
        return this.pets.search(criteria)
    }
}

export class GetPet {
    constructor(private readonly pets: PetRepository) {}

    async execute(id: string): Promise<Pet> {
        const pet = await this.pets.findById(id)
        if (!pet) throw new NotFoundError('Pet not found')
        return pet
    }
}

export class MarkPetAsReunited {
    constructor(
        private readonly pets: PetRepository,
        private readonly clock: Clock
    ) {}

    async execute(id: string, actor: Actor): Promise<Pet> {
        const pet = await new GetPet(this.pets).execute(id)
        pet.markAsReunited(actor, this.clock.now())
        await this.pets.save(pet)
        return pet
    }
}

export class DeletePet {
    constructor(private readonly pets: PetRepository) {}

    async execute(id: string, actor: Actor): Promise<void> {
        const pet = await new GetPet(this.pets).execute(id)
        pet.assertCanBeManagedBy(actor)
        await this.pets.delete(pet.id)
    }
}

export class DescribePetFromImage {
    constructor(private readonly describer: PetDescriber) {}

    execute(imageDataUrl: string): Promise<PetDescription | null> {
        return this.describer.describe(imageDataUrl)
    }
}

export class AuthorizeImageUpload {
    constructor(private readonly images: ImageStorage) {}

    execute(): UploadAuthorization {
        return this.images.authorizeUpload()
    }
}
