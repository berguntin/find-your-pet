import type { Clock } from '../../../shared/application/ports'
import { socialPostMessage } from '../domain/socialPost'
import type { ImageStorage, PetRepository, SocialPostRepository, SocialPublisher } from './ports'

/** Images are sent at this size: what social networks display, without the full-size upload. */
const SOCIAL_IMAGE_SIZE = 1080

export interface SocialPublishingDependencies {
    pets: PetRepository
    images: ImageStorage
    publisher: SocialPublisher
    posts: SocialPostRepository
    /** Public URL of a pet's page. */
    petUrl: (petId: string) => string
    clock: Clock
}

/**
 * Announces a newly published pet. Idempotent: the outbox may deliver the event again, for example
 * when another handler of the same event fails. A crash between publishing and storing the post id
 * would still publish twice; it is rare enough to accept.
 */
export class PublishPetToSocial {
    constructor(private readonly deps: SocialPublishingDependencies) {}

    async execute(petId: string): Promise<void> {
        const { pets, images, publisher, posts, petUrl, clock } = this.deps
        const pet = await pets.findById(petId)
        // Deleted, hidden again or already reunited before the event was handled: nothing to announce.
        if (!pet || !pet.isPublic || pet.isReunited) return
        if (await posts.find(petId, publisher.network)) return

        const snapshot = pet.toSnapshot()
        const postId = await publisher.publish({
            message: socialPostMessage(snapshot, petUrl(petId)),
            imageUrls: snapshot.images.map(url => images.previewUrl(url, SOCIAL_IMAGE_SIZE))
        })
        await posts.save(petId, publisher.network, postId, clock.now())
    }
}

/** Marks the post as reunited, so the groups it was shared to stop spreading it. */
export class UpdateSocialPostOnReunion {
    constructor(private readonly deps: SocialPublishingDependencies) {}

    async execute(petId: string): Promise<void> {
        const { pets, publisher, posts, petUrl } = this.deps
        const postId = await posts.find(petId, publisher.network)
        const pet = postId ? await pets.findById(petId) : null
        if (!postId || !pet) return

        await publisher.updateMessage(postId, socialPostMessage(pet.toSnapshot(), petUrl(petId)))
    }
}

/** Deletes the post of a deleted pet. */
export class RemoveSocialPost {
    constructor(private readonly deps: SocialPublishingDependencies) {}

    async execute(petId: string): Promise<void> {
        const { publisher, posts } = this.deps
        const postId = await posts.find(petId, publisher.network)
        if (!postId) return

        await publisher.remove(postId)
        await posts.remove(petId, publisher.network)
    }
}
