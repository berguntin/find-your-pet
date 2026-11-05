/**
 * HTTP tests for the /api/v1 handlers: real handlers, routing, validation and error mapping,
 * with the container swapped for in-memory adapters. Lives outside server/api so Nitro
 * does not turn it into a route.
 */
import { randomUUID } from 'node:crypto'
import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminPetDto, AdminPetPageDto, ModerationOverviewDto, PetStatsDto } from '../../contracts/admin'
import type { ApiErrorDto, PetDto, PetMatchListDto, PetPageDto, ReportPetRequest } from '../../contracts/pets'
import type { Container } from '../container'
import { createPetsModule } from '../modules/pets'
import { petSearchText } from '../modules/pets/application/search'
import type { ContentModerator, PetDescriber } from '../modules/pets/application/ports'
import { FakeEmbedder } from '../modules/pets/infrastructure/FakeEmbedder'
import { UnavailableEmbedder } from '../modules/pets/infrastructure/GeminiEmbedder'
import { InMemoryModerationLog } from '../modules/pets/infrastructure/InMemoryModerationLog'
import { InMemoryImageStorage } from '../modules/pets/infrastructure/InMemoryImageStorage'
import { InMemoryPetEmbeddingIndex } from '../modules/pets/infrastructure/InMemoryPetEmbeddingIndex'
import { InMemoryPetRepository } from '../modules/pets/infrastructure/InMemoryPetRepository'
import { EventHandlerRegistry, ProcessOutbox } from '../shared/application/outbox'
import type { RateLimiter } from '../shared/application/rateLimit'

let container: Container
const processOutboxInBackground = vi.fn()

vi.mock('../container', () => ({ useContainer: () => container, processOutboxInBackground }))
vi.mock('consola', () => ({ consola: { error: vi.fn() } }))

const { default: listPets } = await import('../api/v1/pets/index.get')
const { default: reportPet } = await import('../api/v1/pets/index.post')
const { default: getPet } = await import('../api/v1/pets/[id].get')
const { default: updatePet } = await import('../api/v1/pets/[id].patch')
const { default: deletePet } = await import('../api/v1/pets/[id].delete')
const { default: describePet } = await import('../api/v1/pets/describe.post')
const { default: searchByImage } = await import('../api/v1/pets/search-by-image.post')
const { default: signUpload } = await import('../api/v1/uploads/signature.post')
const { default: adminListPets } = await import('../api/v1/admin/pets/index.get')
const { default: adminGetPet } = await import('../api/v1/admin/pets/[id].get')
const { default: adminUpdatePet } = await import('../api/v1/admin/pets/[id].patch')
const { default: adminStats } = await import('../api/v1/admin/stats.get')
const { default: adminModeration } = await import('../api/v1/admin/moderation.get')
const { default: moderatePet } = await import('../api/v1/admin/pets/[id]/moderation.patch')
const { default: processOutbox } = await import('../api/internal/outbox/process')
const { default: cleanUpImages } = await import('../api/internal/images/cleanup')
const { default: backfillSearch } = await import('../api/internal/search/backfill')

const router = createRouter()
    .get('/api/v1/pets', listPets)
    .post('/api/v1/pets', reportPet)
    .post('/api/v1/pets/describe', describePet)
    .post('/api/v1/pets/search-by-image', searchByImage)
    .get('/api/v1/pets/:id', getPet)
    .patch('/api/v1/pets/:id', updatePet)
    .delete('/api/v1/pets/:id', deletePet)
    .post('/api/v1/uploads/signature', signUpload)
    .get('/api/v1/admin/pets', adminListPets)
    .get('/api/v1/admin/pets/:id', adminGetPet)
    .patch('/api/v1/admin/pets/:id', adminUpdatePet)
    .get('/api/v1/admin/stats', adminStats)
    .get('/api/v1/admin/moderation', adminModeration)
    .patch('/api/v1/admin/pets/:id/moderation', moderatePet)
    .use('/api/internal/outbox/process', processOutbox)
    .use('/api/internal/images/cleanup', cleanUpImages)
    .use('/api/internal/search/backfill', backfillSearch)
const handler = toWebHandler(createApp().use(router))

const ADMIN_TOKEN = 'admin-token'
const ADMIN_EMAIL = 'admin@example.com'
const INTERNAL_TOKEN = 'internal-token'
const IMAGE = 'https://storage.test/pets/1.jpg'

const APPROVE = { isPetReport: 0.95, showsAnimal: 0.9, inappropriate: 0.01 }
const REVIEW = { isPetReport: 0.5, showsAnimal: 0.9, inappropriate: 0.01 }
const REJECT = { isPetReport: 0.05, showsAnimal: 0.1, inappropriate: 0.01 }

async function call<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; rawBody?: string; token?: string } = {}
): Promise<{ status: number; body: T; headers: Headers }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (options.token) headers.authorization = `Bearer ${options.token}`
    const response = await handler(
        new Request(`http://test${path}`, {
            method,
            headers,
            body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body))
        })
    )
    const text = await response.text()
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers }
}

const report = (overrides: Partial<ReportPetRequest> = {}): ReportPetRequest => ({
    reportType: 'lost',
    species: 'dog',
    name: 'Rex',
    description: 'Perro negro',
    location: 'Paiporta',
    contact: '600000000',
    eventDate: '2026-10-18',
    images: [IMAGE],
    ...overrides
})

async function createPet(overrides: Partial<ReportPetRequest> = {}): Promise<PetDto> {
    const { status, body } = await call<PetDto>('POST', '/api/v1/pets', { body: report(overrides) })
    expect(status).toBe(201)
    return body
}

let describer: { describe: ReturnType<typeof vi.fn<PetDescriber['describe']>> }
let moderator: { model: string | null; review: ReturnType<typeof vi.fn<ContentModerator['review']>> }
let moderationLog: InMemoryModerationLog
let sessionEmail: string | null
let rateLimiter: { consume: ReturnType<typeof vi.fn<RateLimiter['consume']>> }
let repository: InMemoryPetRepository
let images: InMemoryImageStorage
let embedder: FakeEmbedder
let embeddingIndex: InMemoryPetEmbeddingIndex
let buildPets: (overrides?: { embedder?: FakeEmbedder | UnavailableEmbedder }) => Container['pets']

beforeEach(() => {
    let seconds = 0
    const clock = { now: () => new Date(Date.UTC(2026, 9, 19, 10, 0, seconds++)) }
    describer = { describe: vi.fn<PetDescriber['describe']>().mockResolvedValue(null) }
    moderator = { model: 'test-moderator', review: vi.fn<ContentModerator['review']>().mockResolvedValue(APPROVE) }
    moderationLog = new InMemoryModerationLog()
    sessionEmail = null
    rateLimiter = {
        consume: vi.fn<RateLimiter['consume']>().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
    }
    repository = new InMemoryPetRepository()
    images = new InMemoryImageStorage()
    embedder = new FakeEmbedder()
    // Anything a test does not register embeds far from every query.
    embedder.fallback = [0, -1]
    embeddingIndex = new InMemoryPetEmbeddingIndex()
    processOutboxInBackground.mockReset()
    buildPets = (overrides = {}) =>
        createPetsModule({
            pets: repository,
            images,
            describer,
            moderator,
            moderationLog,
            embedder: overrides.embedder ?? embedder,
            embeddingIndex,
            matchCalibration: { floor: 0.9, ceiling: 1 },
            clock,
            ids: { next: () => randomUUID() }
        })
    container = {
        config: { internalToken: INTERNAL_TOKEN, cronSecret: undefined },
        adminAccess: { adminToken: ADMIN_TOKEN, adminEmails: [ADMIN_EMAIL], sessionEmail: async () => sessionEmail },
        rateLimiter,
        processOutbox: new ProcessOutbox(repository.outbox, new EventHandlerRegistry(), clock),
        pets: buildPets()
    }
})

describe('POST /api/v1/pets', () => {
    it('creates a pet and returns it with 201', async () => {
        const pet = await createPet()

        expect(pet).toMatchObject({
            reportType: 'lost',
            name: 'Rex',
            resolution: 'open',
            alive: true,
            moderationStatus: 'approved'
        })
        expect(pet).not.toHaveProperty('ownerId')
        expect(pet).not.toHaveProperty('moderationScores')
    })

    it('processes the outbox after responding', async () => {
        await createPet()

        expect(processOutboxInBackground).toHaveBeenCalledOnce()
    })

    it('accepts uncertain reports but keeps them hidden', async () => {
        moderator.review.mockResolvedValueOnce(REVIEW)
        const pet = await createPet()

        expect(pet.moderationStatus).toBe('pending_review')
        expect((await call<PetPageDto>('GET', '/api/v1/pets')).body.items).toEqual([])
        expect((await call('GET', `/api/v1/pets/${pet.id}`)).status).toBe(404)
        expect((await call('GET', `/api/v1/pets/${pet.id}`, { token: ADMIN_TOKEN })).status).toBe(200)
    })

    it('rejects content that is not a pet report with 422 content_rejected', async () => {
        moderator.review.mockResolvedValueOnce(REJECT)

        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets', { body: report() })

        expect(status).toBe(422)
        expect(body.error.code).toBe('content_rejected')
        expect(repository.outbox.pending()).toEqual([])
        expect(images.deleted).toEqual([IMAGE])
    })

    it('returns 429 with Retry-After when over the rate limit', async () => {
        rateLimiter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 })

        const { status, body, headers } = await call<ApiErrorDto>('POST', '/api/v1/pets', { body: report() })

        expect(status).toBe(429)
        expect(body.error.code).toBe('rate_limited')
        expect(headers.get('retry-after')).toBe('42')
        expect(moderator.review).not.toHaveBeenCalled()
    })

    it('does not count invalid requests against the rate limit', async () => {
        await call('POST', '/api/v1/pets', { body: { reportType: 'nope' } })

        expect(rateLimiter.consume).not.toHaveBeenCalled()
    })

    it('returns 422 with the invalid fields', async () => {
        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets', {
            body: report({ reportType: 'stolen' as never, images: [] })
        })

        expect(status).toBe(422)
        expect(body.error.code).toBe('validation')
        expect(body.error.details?.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: 'reportType' }),
                expect.objectContaining({ path: 'images' })
            ])
        )
    })

    it('returns 422 for domain rules, such as a future date', async () => {
        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets', {
            body: report({ eventDate: '2027-01-01' })
        })

        expect(status).toBe(422)
        expect(body.error.details).toEqual({ field: 'eventDate' })
    })

    it('rejects images not uploaded through the app', async () => {
        const { status } = await call('POST', '/api/v1/pets', {
            body: report({ images: ['https://evil.test/a.jpg'] })
        })

        expect(status).toBe(422)
    })

    it('returns 400 for a malformed JSON body', async () => {
        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets', { rawBody: '{"reportType":' })

        expect(status).toBe(400)
        expect(body.error.code).toBe('validation')
    })
})

describe('GET /api/v1/pets', () => {
    it('returns an empty page', async () => {
        expect(await call('GET', '/api/v1/pets')).toMatchObject({ status: 200, body: { items: [], nextCursor: null } })
    })

    it('filters by report type and text', async () => {
        await createPet({ description: 'Gato naranja', species: 'cat' })
        await createPet({ reportType: 'found', location: 'Catarroja' })

        const found = await call<PetPageDto>('GET', '/api/v1/pets?reportType=found')
        const byText = await call<PetPageDto>('GET', '/api/v1/pets?q=naranja')

        expect(found.body.items.map(p => p.location)).toEqual(['Catarroja'])
        expect(byText.body.items.map(p => p.species)).toEqual(['cat'])
    })

    it('paginates newest first with a cursor', async () => {
        for (const name of ['uno', 'dos', 'tres']) await createPet({ name })

        const first = await call<PetPageDto>('GET', '/api/v1/pets?limit=2')
        const second = await call<PetPageDto>(
            'GET',
            `/api/v1/pets?limit=2&cursor=${encodeURIComponent(first.body.nextCursor!)}`
        )

        expect(first.body.items.map(p => p.name)).toEqual(['tres', 'dos'])
        expect(second.body.items.map(p => p.name)).toEqual(['uno'])
        expect(second.body.nextCursor).toBeNull()
    })

    it.each(['limit=0', 'limit=500', 'reportType=all', 'species=Perro'])('returns 422 for %s', async query => {
        expect((await call('GET', `/api/v1/pets?${query}`)).status).toBe(422)
    })
})

describe('GET /api/v1/pets/:id', () => {
    it('returns the pet', async () => {
        const pet = await createPet()

        expect(await call('GET', `/api/v1/pets/${pet.id}`)).toMatchObject({ status: 200, body: pet })
    })

    it.each([randomUUID(), 'not-a-uuid'])('returns 404 for unknown id %s', async id => {
        const { status, body } = await call<ApiErrorDto>('GET', `/api/v1/pets/${id}`)

        expect(status).toBe(404)
        expect(body.error.code).toBe('not_found')
    })
})

describe('PATCH /api/v1/pets/:id', () => {
    const reunite = (id: string, token?: string) =>
        call<PetDto & ApiErrorDto>('PATCH', `/api/v1/pets/${id}`, { body: { resolution: 'reunited' }, token })

    it('lets the admin mark a pet as reunited', async () => {
        const pet = await createPet()
        const { status, body } = await reunite(pet.id, ADMIN_TOKEN)

        expect(status).toBe(200)
        expect(body).toMatchObject({ resolution: 'reunited', resolvedBy: 'admin' })
    })

    it.each([
        ['without a token', undefined],
        ['with a wrong token', 'not-the-token'],
        ['with a token that only shares a prefix', `${ADMIN_TOKEN}x`]
    ])('returns 403 %s', async (_, token) => {
        const pet = await createPet()

        expect((await reunite(pet.id, token)).status).toBe(403)
    })

    it('returns 409 when the pet is already reunited', async () => {
        const pet = await createPet()
        await reunite(pet.id, ADMIN_TOKEN)

        expect((await reunite(pet.id, ADMIN_TOKEN)).body.error.code).toBe('conflict')
    })

    it('returns 422 for unsupported changes', async () => {
        const pet = await createPet()
        const { status } = await call('PATCH', `/api/v1/pets/${pet.id}`, {
            body: { resolution: 'open' },
            token: ADMIN_TOKEN
        })

        expect(status).toBe(422)
    })

    it('returns 404 for unknown pets', async () => {
        expect((await reunite(randomUUID(), ADMIN_TOKEN)).status).toBe(404)
    })

    it('rejects every token when no admin token is configured', async () => {
        const pet = await createPet()
        container.adminAccess = { ...container.adminAccess, adminToken: undefined }

        expect((await reunite(pet.id, 'undefined')).status).toBe(403)
    })
})

describe('DELETE /api/v1/pets/:id', () => {
    it('requires the admin token', async () => {
        const pet = await createPet()

        expect((await call('DELETE', `/api/v1/pets/${pet.id}`)).status).toBe(403)
        expect((await call('GET', `/api/v1/pets/${pet.id}`)).status).toBe(200)
    })

    it('deletes the pet with 204', async () => {
        const pet = await createPet()

        expect(await call('DELETE', `/api/v1/pets/${pet.id}`, { token: ADMIN_TOKEN })).toMatchObject({
            status: 204,
            body: null
        })
        expect((await call('GET', `/api/v1/pets/${pet.id}`)).status).toBe(404)
    })
})

describe('POST /api/v1/pets/describe', () => {
    const image = 'data:image/jpeg;base64,AAAA'

    it('returns the description of a pet', async () => {
        describer.describe.mockResolvedValue({
            species: 'cat',
            description: 'Gata gris',
            name: null,
            location: null,
            contact: null,
            eventDate: null
        })

        const { status, body } = await call('POST', '/api/v1/pets/describe', { body: { image } })

        expect(status).toBe(200)
        expect(body).toMatchObject({ isPet: true, species: 'cat', description: 'Gata gris' })
        expect(describer.describe).toHaveBeenCalledWith(image)
    })

    it('says when the image is not a pet', async () => {
        const { body } = await call('POST', '/api/v1/pets/describe', { body: { image } })

        expect(body).toMatchObject({ isPet: false })
    })

    it('is rate limited', async () => {
        rateLimiter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 })

        const { status } = await call('POST', '/api/v1/pets/describe', { body: { image } })

        expect(status).toBe(429)
        expect(describer.describe).not.toHaveBeenCalled()
        expect(rateLimiter.consume.mock.calls[0]![0]).toMatchObject({ name: 'describe' })
    })

    it('validates the image before calling the model', async () => {
        const { status } = await call('POST', '/api/v1/pets/describe', { body: { image: 'https://img.test/a.jpg' } })

        expect(status).toBe(422)
        expect(describer.describe).not.toHaveBeenCalled()
    })

    it('hides unexpected errors behind a 500', async () => {
        describer.describe.mockRejectedValue(new Error('OpenAI key sk-123 is invalid'))

        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets/describe', { body: { image } })

        expect(status).toBe(500)
        expect(body.error.code).toBe('internal')
        expect(JSON.stringify(body)).not.toContain('sk-123')
    })
})

describe('POST /api/v1/uploads/signature', () => {
    it('returns the signed upload parameters', async () => {
        expect(await call('POST', '/api/v1/uploads/signature')).toMatchObject({
            status: 200,
            body: { uploadUrl: 'https://storage.test/upload', fields: { signature: 'sig' } }
        })
    })
})

describe('admin moderation endpoints', () => {
    const reportPending = async () => {
        moderator.review.mockResolvedValueOnce(REVIEW)
        return createPet()
    }

    it('lists pending reports for admins only', async () => {
        await createPet()
        const pending = await reportPending()

        expect((await call('GET', '/api/v1/admin/pets')).status).toBe(403)
        const { body } = await call<PetPageDto>('GET', '/api/v1/admin/pets', { token: ADMIN_TOKEN })
        expect(body.items.map(p => p.id)).toEqual([pending.id])
    })

    it('filters by moderation status', async () => {
        await createPet()
        await reportPending()

        const { body } = await call<PetPageDto>('GET', '/api/v1/admin/pets?moderationStatus=approved', {
            token: ADMIN_TOKEN
        })
        expect(body.items).toHaveLength(1)
    })

    it('publishes a pending report', async () => {
        const pending = await reportPending()
        processOutboxInBackground.mockReset()

        const { status, body } = await call<PetDto>('PATCH', `/api/v1/admin/pets/${pending.id}/moderation`, {
            body: { status: 'approved' },
            token: ADMIN_TOKEN
        })

        expect(status).toBe(200)
        expect(body.moderationStatus).toBe('approved')
        expect(processOutboxInBackground).toHaveBeenCalledOnce()
        expect((await call('GET', `/api/v1/pets/${pending.id}`)).status).toBe(200)
    })

    it('rejects a pending report, deleting it and its images', async () => {
        const pending = await reportPending()

        const { status } = await call('PATCH', `/api/v1/admin/pets/${pending.id}/moderation`, {
            body: { status: 'rejected' },
            token: ADMIN_TOKEN
        })

        expect(status).toBe(204)
        expect((await call('GET', `/api/v1/pets/${pending.id}`, { token: ADMIN_TOKEN })).status).toBe(404)
        expect(images.deleted).toEqual([IMAGE])
    })

    it('requires the admin token and a valid status', async () => {
        const pending = await reportPending()
        const path = `/api/v1/admin/pets/${pending.id}/moderation`

        expect((await call('PATCH', path, { body: { status: 'approved' } })).status).toBe(403)
        expect((await call('PATCH', path, { body: { status: 'maybe' }, token: ADMIN_TOKEN })).status).toBe(422)
    })
})

describe('admin panel session', () => {
    it('treats a signed-in admin email like the admin token', async () => {
        const pet = await createPet()
        sessionEmail = 'Admin@Example.com'

        expect((await call('GET', '/api/v1/admin/pets')).status).toBe(200)
        expect((await call('DELETE', `/api/v1/pets/${pet.id}`)).status).toBe(204)
    })

    it('ignores sessions of emails not on the allowlist', async () => {
        sessionEmail = 'someone@example.com'

        expect((await call('GET', '/api/v1/admin/pets')).status).toBe(403)
    })
})

describe('admin pet management endpoints', () => {
    it('lists every pet with its moderation details', async () => {
        await createPet()
        moderator.review.mockResolvedValueOnce(REVIEW)
        await createPet()

        const { body } = await call<AdminPetPageDto>('GET', '/api/v1/admin/pets?moderationStatus=all', {
            token: ADMIN_TOKEN
        })

        expect(body.items).toHaveLength(2)
        expect(body.items[0]).toMatchObject({ moderationScores: REVIEW, moderatedAt: expect.any(String) })
    })

    it('gets any pet for admins only', async () => {
        moderator.review.mockResolvedValueOnce(REVIEW)
        const pet = await createPet()

        expect((await call('GET', `/api/v1/admin/pets/${pet.id}`)).status).toBe(403)
        const { status, body } = await call<AdminPetDto>('GET', `/api/v1/admin/pets/${pet.id}`, { token: ADMIN_TOKEN })
        expect(status).toBe(200)
        expect(body).toMatchObject({ id: pet.id, moderationStatus: 'pending_review', moderationScores: REVIEW })
        expect((await call('GET', '/api/v1/admin/pets/nope', { token: ADMIN_TOKEN })).status).toBe(404)
    })

    it('edits any detail and the resolution', async () => {
        const pet = await createPet()
        const second = images.upload('second.jpg')
        processOutboxInBackground.mockReset()

        const { status, body } = await call<AdminPetDto>('PATCH', `/api/v1/admin/pets/${pet.id}`, {
            body: { name: null, location: 'Sedaví', images: [second, IMAGE], resolution: 'reunited' },
            token: ADMIN_TOKEN
        })

        expect(status).toBe(200)
        expect(body).toMatchObject({ name: null, location: 'Sedaví', images: [second, IMAGE], resolution: 'reunited' })
        expect(processOutboxInBackground).toHaveBeenCalledOnce()
    })

    it('validates edits and requires an admin', async () => {
        const pet = await createPet()
        const path = `/api/v1/admin/pets/${pet.id}`

        expect((await call('PATCH', path, { body: { location: 'Sedaví' } })).status).toBe(403)
        expect((await call('PATCH', path, { body: { ownerId: 'x' }, token: ADMIN_TOKEN })).status).toBe(422)
        expect((await call('PATCH', path, { body: { images: [] }, token: ADMIN_TOKEN })).status).toBe(422)
        expect((await call('PATCH', '/api/v1/admin/pets/nope', { body: {}, token: ADMIN_TOKEN })).status).toBe(404)
    })

    it('hides a published pet back to review', async () => {
        const pet = await createPet()

        const { body } = await call<AdminPetDto>('PATCH', `/api/v1/admin/pets/${pet.id}/moderation`, {
            body: { status: 'pending_review' },
            token: ADMIN_TOKEN
        })

        expect(body.moderationStatus).toBe('pending_review')
        expect((await call('GET', `/api/v1/pets/${pet.id}`)).status).toBe(404)
    })
})

describe('admin statistics endpoints', () => {
    it('returns pet statistics for the requested period', async () => {
        await createPet()

        const { status, body } = await call<PetStatsDto>('GET', '/api/v1/admin/stats?days=7', { token: ADMIN_TOKEN })

        expect(status).toBe(200)
        expect(body.daily).toHaveLength(7)
        expect(body.totals).toMatchObject({ all: 1, published: 1 })
    })

    it('returns the moderation overview', async () => {
        await createPet()

        const { status, body } = await call<ModerationOverviewDto>('GET', '/api/v1/admin/moderation', {
            token: ADMIN_TOKEN
        })

        expect(status).toBe(200)
        expect(body.days).toBe(30)
        expect(body.moderator).toMatchObject({ enabled: true, model: 'test-moderator' })
        expect(body.recent).toEqual([expect.objectContaining({ decision: 'approved', decidedAt: expect.any(String) })])
    })

    it.each(['/api/v1/admin/stats', '/api/v1/admin/moderation'])('%s is admin only and validates days', async path => {
        expect((await call('GET', path)).status).toBe(403)
        expect((await call('GET', `${path}?days=12`, { token: ADMIN_TOKEN })).status).toBe(422)
    })
})

describe('internal endpoints', () => {
    it.each(['/api/internal/outbox/process', '/api/internal/images/cleanup', '/api/internal/search/backfill'])(
        'reject calls without the internal token: %s',
        async path => {
            expect((await call('POST', path)).status).toBe(401)
            expect((await call('POST', path, { token: ADMIN_TOKEN })).status).toBe(401)
        }
    )

    it('processes pending outbox events', async () => {
        await createPet()
        await createPet()

        const { status, body } = await call('POST', '/api/internal/outbox/process', { token: INTERNAL_TOKEN })

        expect(status).toBe(200)
        expect(body).toEqual({ processed: 2, failed: 0 })
        expect(repository.outbox.pending()).toEqual([])
    })

    it('indexes published pets missing from search', async () => {
        await createPet()

        const { status, body } = await call('POST', '/api/internal/search/backfill', { token: INTERNAL_TOKEN })

        expect(status).toBe(200)
        expect(body).toEqual({ indexed: 1, failed: 0, remaining: 0 })
        expect(embeddingIndex.entries.size).toBe(1)
    })

    it('accepts Vercel Cron calls with CRON_SECRET', async () => {
        container.config = { ...container.config, cronSecret: 'cron-secret' }

        const { status } = await call('GET', '/api/internal/outbox/process', { token: 'cron-secret' })

        expect(status).toBe(200)
    })

    it('is disabled when no internal token is configured', async () => {
        container.config = { internalToken: undefined, cronSecret: undefined }

        expect((await call('POST', '/api/internal/outbox/process', { token: 'undefined' })).status).toBe(401)
    })

    it('cleans up orphan images', async () => {
        images.upload('orphan.jpg', new Date('2026-01-01T00:00:00Z'))

        const { body } = await call('POST', '/api/internal/images/cleanup', { token: INTERNAL_TOKEN })

        expect(body).toEqual({ deleted: 1 })
    })
})

describe('POST /api/v1/pets/search-by-image', () => {
    const photo = `data:image/jpeg;base64,${Buffer.from('my-dog').toString('base64')}`

    it('returns similar public pets with their match percentage', async () => {
        const pet = await createPet()
        embedder.register(images.previewUrl(IMAGE, 512), [1, 0]).register('my-dog', [1, 0])
        await container.pets.indexForSearch.execute(pet.id)

        const { status, body } = await call<PetMatchListDto>('POST', '/api/v1/pets/search-by-image', {
            body: { image: photo }
        })

        expect(status).toBe(200)
        expect(body.items).toEqual([{ pet: expect.objectContaining({ id: pet.id }), match: 100 }])
        expect(embedder.calls.at(-1)).toEqual([{ kind: 'bytes', mimeType: 'image/jpeg', data: Buffer.from('my-dog') }])
    })

    it('returns an empty list when nothing looks alike', async () => {
        embedder.register('my-dog', [1, 0])

        const { body } = await call('POST', '/api/v1/pets/search-by-image', { body: { image: photo } })

        expect(body).toEqual({ items: [] })
    })

    it('validates the photo', async () => {
        expect((await call('POST', '/api/v1/pets/search-by-image', { body: { image: 'nope' } })).status).toBe(422)
    })

    it('is rate limited', async () => {
        rateLimiter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 })

        const { status } = await call('POST', '/api/v1/pets/search-by-image', { body: { image: photo } })

        expect(status).toBe(429)
        expect(rateLimiter.consume.mock.calls[0]![0]).toMatchObject({ name: 'search-by-image' })
    })

    it('answers 503 when image search is not configured', async () => {
        container.pets = buildPets({ embedder: new UnavailableEmbedder() })

        const { status, body } = await call<ApiErrorDto>('POST', '/api/v1/pets/search-by-image', {
            body: { image: photo }
        })

        expect(status).toBe(503)
        expect(body.error.code).toBe('unavailable')
    })
})

describe('GET /api/v1/pets?q= (semantic search)', () => {
    const reportAndIndex = async (description: string, textVector: number[]) => {
        const pet = await createPet({ description })
        embedder.register(images.previewUrl(IMAGE, 512), [0, -1])
        embedder.register(petSearchText((await repository.findById(pet.id))!.toSnapshot()), textVector)
        await container.pets.indexForSearch.execute(pet.id)
        return pet
    }

    it('returns keyword hits first and then pets that mean the same', async () => {
        const semantic = await reportAndIndex('Mestizo de pelo oscuro', [1, 0])
        const keyword = await reportAndIndex('Perro negro con collar', [1, 0])
        await reportAndIndex('Gato blanco', [0, 1])
        embedder.register('perro negro', [1, 0])

        const { status, body } = await call<PetPageDto>('GET', `/api/v1/pets?q=${encodeURIComponent('perro negro')}`)

        expect(status).toBe(200)
        expect(body.items.map(p => p.id)).toEqual([keyword.id, semantic.id])
        expect(body.nextCursor).toBeNull()
        expect(rateLimiter.consume.mock.calls.at(-1)![0]).toMatchObject({ name: 'semantic-search' })
    })

    it('falls back to keywords instead of failing when over the semantic rate limit', async () => {
        await reportAndIndex('Mestizo de pelo oscuro', [1, 0])
        const keyword = await reportAndIndex('Perro negro con collar', [1, 0])
        embedder.register('perro negro', [1, 0])
        rateLimiter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 })

        const { status, body } = await call<PetPageDto>('GET', `/api/v1/pets?q=${encodeURIComponent('perro negro')}`)

        expect(status).toBe(200)
        expect(body.items.map(p => p.id)).toEqual([keyword.id])
    })

    it('does not count listings without a query against the semantic rate limit', async () => {
        await call('GET', '/api/v1/pets')

        expect(rateLimiter.consume).not.toHaveBeenCalled()
    })
})
