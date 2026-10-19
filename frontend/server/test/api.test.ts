/**
 * HTTP tests for the /api/v1 handlers: real handlers, routing, validation and error mapping,
 * with the container swapped for in-memory adapters. Lives outside server/api so Nitro
 * does not turn it into a route.
 */
import { randomUUID } from 'node:crypto'
import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiErrorDto, PetDto, PetPageDto, ReportPetRequest } from '../../contracts/pets'
import type { Container } from '../container'
import { createPetsModule } from '../modules/pets'
import type { PetDescriber } from '../modules/pets/application/ports'
import { InMemoryPetRepository } from '../modules/pets/infrastructure/InMemoryPetRepository'

let container: Container

vi.mock('../container', () => ({ useContainer: () => container }))
vi.mock('consola', () => ({ consola: { error: vi.fn() } }))

const { default: listPets } = await import('../api/v1/pets/index.get')
const { default: reportPet } = await import('../api/v1/pets/index.post')
const { default: getPet } = await import('../api/v1/pets/[id].get')
const { default: updatePet } = await import('../api/v1/pets/[id].patch')
const { default: deletePet } = await import('../api/v1/pets/[id].delete')
const { default: describePet } = await import('../api/v1/pets/describe.post')
const { default: signUpload } = await import('../api/v1/uploads/signature.post')

const router = createRouter()
    .get('/api/v1/pets', listPets)
    .post('/api/v1/pets', reportPet)
    .post('/api/v1/pets/describe', describePet)
    .get('/api/v1/pets/:id', getPet)
    .patch('/api/v1/pets/:id', updatePet)
    .delete('/api/v1/pets/:id', deletePet)
    .post('/api/v1/uploads/signature', signUpload)
const handler = toWebHandler(createApp().use(router))

const ADMIN_TOKEN = 'admin-token'
const IMAGE = 'https://storage.test/pets/1.jpg'

async function call<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; rawBody?: string; token?: string } = {}
): Promise<{ status: number; body: T }> {
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
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T }
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

beforeEach(() => {
    let seconds = 0
    describer = { describe: vi.fn<PetDescriber['describe']>().mockResolvedValue(null) }
    container = {
        config: { adminToken: ADMIN_TOKEN },
        pets: createPetsModule({
            pets: new InMemoryPetRepository(),
            images: {
                isManagedUrl: url => url.startsWith('https://storage.test/pets/'),
                authorizeUpload: () => ({ uploadUrl: 'https://storage.test/upload', fields: { signature: 'sig' } })
            },
            describer,
            clock: { now: () => new Date(Date.UTC(2026, 9, 19, 10, 0, seconds++)) },
            ids: { next: () => randomUUID() }
        })
    }
})

describe('POST /api/v1/pets', () => {
    it('creates a pet and returns it with 201', async () => {
        const pet = await createPet()

        expect(pet).toMatchObject({ reportType: 'lost', name: 'Rex', resolution: 'open', alive: true })
        expect(pet).not.toHaveProperty('ownerId')
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
        expect(await call('GET', '/api/v1/pets')).toEqual({ status: 200, body: { items: [], nextCursor: null } })
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

        expect(await call('GET', `/api/v1/pets/${pet.id}`)).toEqual({ status: 200, body: pet })
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
        container.config = { adminToken: undefined }

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

        expect(await call('DELETE', `/api/v1/pets/${pet.id}`, { token: ADMIN_TOKEN })).toEqual({
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
        expect(await call('POST', '/api/v1/uploads/signature')).toEqual({
            status: 200,
            body: { uploadUrl: 'https://storage.test/upload', fields: { signature: 'sig' } }
        })
    })
})
