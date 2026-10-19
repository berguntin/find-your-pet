import { describe, expect, it } from 'vitest'
import { Pet } from '../../domain/Pet'
import { toPetDescriptionDto, toPetDto, toPetPageDto } from './presenter'

const pet = () =>
    Pet.report(
        {
            reportType: 'found',
            species: 'other',
            description: 'Conejo blanco',
            location: 'Massanassa',
            contact: '600000000',
            images: ['https://img.test/1.jpg'],
            eventDate: '2026-10-18'
        },
        { id: 'pet-1', now: new Date('2026-10-19T10:00:00Z'), ownerId: 'user-secret-id' }
    )

describe('pet presenter', () => {
    it('serialises dates as ISO strings and hides the owner', () => {
        const dto = toPetDto(pet())

        expect(dto).toMatchObject({ id: 'pet-1', createdAt: '2026-10-19T10:00:00.000Z', resolvedAt: null })
        expect(dto).not.toHaveProperty('ownerId')
        expect(JSON.stringify(dto)).not.toContain('user-secret-id')
    })

    it('includes the resolution date once reunited', () => {
        const reunited = pet()
        reunited.markAsReunited({ kind: 'admin' }, new Date('2026-10-20T08:00:00Z'))

        expect(toPetDto(reunited)).toMatchObject({ resolution: 'reunited', resolvedAt: '2026-10-20T08:00:00.000Z' })
    })

    it('keeps the cursor of a page', () => {
        expect(toPetPageDto({ items: [pet()], nextCursor: 'abc' })).toMatchObject({ nextCursor: 'abc' })
    })

    it('flags descriptions that are not pets', () => {
        expect(toPetDescriptionDto(null)).toMatchObject({ isPet: false, description: null })
        expect(
            toPetDescriptionDto({
                species: 'cat',
                description: 'Gato',
                name: null,
                location: null,
                contact: null,
                eventDate: null
            })
        ).toMatchObject({ isPet: true, species: 'cat' })
    })
})
