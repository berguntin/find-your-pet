import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventHandlerRegistry, ProcessOutbox } from '../../../shared/application/outbox'
import type { Actor } from '../../../shared/domain/actor'
import type { ModerationScores } from '../domain/moderation'
import { createPetsModule, createSocialPublishing, socialEventHandlers, type PetsModule } from '../index'
import { FakeEmbedder } from '../infrastructure/FakeEmbedder'
import { InMemoryImageStorage } from '../infrastructure/InMemoryImageStorage'
import { InMemoryPetEmbeddingIndex } from '../infrastructure/InMemoryPetEmbeddingIndex'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import { InMemorySocialPostRepository } from '../infrastructure/InMemorySocialPostRepository'
import type { SocialPost, SocialPublisher } from './ports'

const anonymous: Actor = { kind: 'anonymous' }
const admin: Actor = { kind: 'admin' }

const APPROVE: ModerationScores = { isPetReport: 0.95, showsAnimal: 0.9, inappropriate: 0.01 }
const REVIEW: ModerationScores = { isPetReport: 0.5, showsAnimal: 0.9, inappropriate: 0.01 }

class FakePublisher implements SocialPublisher {
    readonly network = 'facebook'
    readonly published: SocialPost[] = []
    readonly updates: Array<[string, string]> = []
    readonly removed: string[] = []

    async publish(post: SocialPost): Promise<string> {
        this.published.push(post)
        return `post-${this.published.length}`
    }

    async updateMessage(postId: string, message: string): Promise<void> {
        this.updates.push([postId, message])
    }

    async remove(postId: string): Promise<void> {
        this.removed.push(postId)
    }
}

describe('social publishing', () => {
    let repository: InMemoryPetRepository
    let images: InMemoryImageStorage
    let publisher: FakePublisher
    let posts: InMemorySocialPostRepository
    let pets: PetsModule
    let processOutbox: ProcessOutbox
    let review: ReturnType<typeof vi.fn>

    const report = () =>
        pets.report.execute(
            {
                reportType: 'lost',
                species: 'dog',
                name: 'Toby',
                description: 'Perro marrón',
                location: 'Paiporta',
                contact: '600000000',
                eventDate: '2026-10-01',
                images: [images.upload('a.jpg'), images.upload('b.jpg')]
            },
            anonymous
        )

    beforeEach(() => {
        repository = new InMemoryPetRepository()
        images = new InMemoryImageStorage()
        publisher = new FakePublisher()
        posts = new InMemorySocialPostRepository()
        review = vi.fn().mockResolvedValue(APPROVE)
        const clock = { now: () => new Date('2026-10-20T10:00:00Z') }
        let counter = 0
        pets = createPetsModule({
            pets: repository,
            images,
            describer: { describe: vi.fn().mockResolvedValue(null) },
            moderator: { review },
            embedder: new FakeEmbedder(),
            embeddingIndex: new InMemoryPetEmbeddingIndex(),
            clock,
            ids: { next: () => `pet-${++counter}` }
        })
        const social = createSocialPublishing({
            pets: repository,
            images,
            publisher,
            posts,
            petUrl: id => `https://mascotas.example/mascota/${id}`,
            clock
        })
        const registry = new EventHandlerRegistry()
        for (const [type, handler] of Object.entries(socialEventHandlers(social))) registry.on(type, handler)
        processOutbox = new ProcessOutbox(repository.outbox, registry, clock)
    })

    it('announces a published pet with its photos and a link to its page', async () => {
        const pet = await report()
        await processOutbox.execute()

        expect(publisher.published).toHaveLength(1)
        const [post] = publisher.published
        expect(post!.message).toContain('🔴 PERDIDO · Perro · Toby')
        expect(post!.message).toContain(`https://mascotas.example/mascota/${pet.id}`)
        expect(post!.message).not.toContain('600000000')
        expect(post!.imageUrls).toEqual(pet.toSnapshot().images.map(url => images.previewUrl(url, 1080)))
        expect(await posts.find(pet.id, 'facebook')).toBe('post-1')
    })

    it('announces a pet only once, even if the event is delivered again', async () => {
        const pet = await report()
        await processOutbox.execute()

        await createSocialPublishing({
            pets: repository,
            images,
            publisher,
            posts,
            petUrl: id => id,
            clock: { now: () => new Date() }
        }).publish.execute(pet.id)

        expect(publisher.published).toHaveLength(1)
    })

    it('announces pets left for review once an admin approves them', async () => {
        review.mockResolvedValueOnce(REVIEW)
        const pet = await report()
        await processOutbox.execute()
        expect(publisher.published).toHaveLength(0)

        await pets.moderate.execute(pet.id, 'approved', admin)
        await processOutbox.execute()

        expect(publisher.published).toHaveLength(1)
    })

    it('marks the post when the pet is reunited', async () => {
        const pet = await report()
        await processOutbox.execute()

        await pets.markAsReunited.execute(pet.id, admin)
        await processOutbox.execute()

        expect(publisher.updates).toHaveLength(1)
        expect(publisher.updates[0]![0]).toBe('post-1')
        expect(publisher.updates[0]![1]).toMatch(/^✅ ¡YA ESTÁ EN CASA!/)
    })

    it('does not announce a pet reunited before its publication was handled', async () => {
        const pet = await report()
        await pets.markAsReunited.execute(pet.id, admin)
        await processOutbox.execute()

        expect(publisher.published).toHaveLength(0)
        expect(publisher.updates).toHaveLength(0)
    })

    it('deletes the post when the pet is deleted', async () => {
        const pet = await report()
        await processOutbox.execute()

        await pets.delete.execute(pet.id, admin)
        await processOutbox.execute()

        expect(publisher.removed).toEqual(['post-1'])
        expect(await posts.find(pet.id, 'facebook')).toBeNull()
    })

    it('does not announce a pet deleted before its publication was handled', async () => {
        const pet = await report()
        await pets.delete.execute(pet.id, admin)
        await processOutbox.execute()

        expect(publisher.published).toHaveLength(0)
        expect(publisher.removed).toHaveLength(0)
    })
})
