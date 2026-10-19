import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryOutboxStore } from '../infrastructure/InMemoryOutboxStore'
import { EventHandlerRegistry, ProcessOutbox } from './outbox'

describe('ProcessOutbox', () => {
    let outbox: InMemoryOutboxStore
    let registry: EventHandlerRegistry
    let now: Date
    let process: ProcessOutbox

    const record = (type: string) => outbox.append([{ type, occurredAt: now, payload: { petId: 'pet-1' } }])

    beforeEach(() => {
        outbox = new InMemoryOutboxStore()
        registry = new EventHandlerRegistry()
        now = new Date('2026-10-19T10:00:00Z')
        process = new ProcessOutbox(outbox, registry, { now: () => now })
    })

    it('delivers each event to every handler of its type and completes it', async () => {
        const first = vi.fn().mockResolvedValue(undefined)
        const second = vi.fn().mockResolvedValue(undefined)
        const other = vi.fn()
        registry.on('pet.published', first).on('pet.published', second).on('pet.reunited', other)
        record('pet.published')

        expect(await process.execute()).toEqual({ processed: 1, failed: 0 })
        expect(first).toHaveBeenCalledWith(expect.objectContaining({ type: 'pet.published' }))
        expect(second).toHaveBeenCalledOnce()
        expect(other).not.toHaveBeenCalled()
        expect(outbox.pending()).toEqual([])
    })

    it('completes events nobody listens to', async () => {
        record('pet.reunited')

        expect(await process.execute()).toEqual({ processed: 1, failed: 0 })
    })

    it('retries failed events later with exponential backoff', async () => {
        const handler = vi.fn().mockRejectedValueOnce(new Error('index down')).mockResolvedValue(undefined)
        registry.on('pet.published', handler)
        record('pet.published')

        expect(await process.execute()).toEqual({ processed: 0, failed: 1 })
        expect(outbox.events[0]).toMatchObject({ attempts: 1, lastError: 'index down' })
        expect(outbox.events[0]!.availableAt).toEqual(new Date('2026-10-19T10:01:00Z'))

        // Not available yet.
        expect(await process.execute()).toEqual({ processed: 0, failed: 0 })

        now = new Date('2026-10-19T10:01:00Z')
        expect(await process.execute()).toEqual({ processed: 1, failed: 0 })
    })

    it('gives up after the maximum attempts', async () => {
        registry.on('pet.published', vi.fn().mockRejectedValue(new Error('broken')))
        record('pet.published')

        for (let attempt = 0; attempt < 8; attempt++) {
            await process.execute()
            now = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        }

        expect(outbox.events[0]).toMatchObject({ attempts: 8 })
        expect(outbox.events[0]!.deadAt).not.toBeNull()
        expect(await process.execute()).toEqual({ processed: 0, failed: 0 })
    })

    it('does not deliver an event claimed by another run until its lease expires', async () => {
        record('pet.published')
        await outbox.claim(10, now)

        expect(await process.execute()).toEqual({ processed: 0, failed: 0 })
    })

    it('processes in batches', async () => {
        for (let i = 0; i < 3; i++) record('pet.published')

        expect(await process.execute(2)).toEqual({ processed: 2, failed: 0 })
        expect(await process.execute(2)).toEqual({ processed: 1, failed: 0 })
    })
})
