import { describe, expect, it } from 'vitest'
import { parseServerConfig } from './config'

const runtimeConfig = (overrides: Record<string, unknown> = {}) => ({
    databaseUrl: 'postgres://localhost/pets',
    adminToken: '',
    cloudinary: { cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret', folder: 'pets' },
    openai: { apiKey: '', describerModel: 'gpt-4o-mini' },
    public: { baseUrl: 'http://localhost:8000' },
    ...overrides
})

describe('parseServerConfig', () => {
    it('turns empty optional values into undefined', () => {
        const config = parseServerConfig(runtimeConfig())

        expect(config.adminToken).toBeUndefined()
        expect(config.internalToken).toBeUndefined()
        expect(config.openai.apiKey).toBeUndefined()
        expect(config.upstash).toEqual({ url: undefined, token: undefined })
    })

    it('keeps optional values when set', () => {
        const config = parseServerConfig(
            runtimeConfig({
                adminToken: 'token',
                internalToken: 'internal',
                openai: { apiKey: 'sk-test' },
                upstash: { url: 'https://redis.test', token: 'redis-token' }
            })
        )

        expect(config.adminToken).toBe('token')
        expect(config.internalToken).toBe('internal')
        expect(config.openai).toEqual({
            apiKey: 'sk-test',
            describerModel: 'gpt-4o-mini',
            moderationModel: 'gpt-6-luna'
        })
        expect(config.upstash).toEqual({ url: 'https://redis.test', token: 'redis-token' })
    })

    it('lists every missing required variable', () => {
        const parse = () =>
            parseServerConfig(
                runtimeConfig({ databaseUrl: '', cloudinary: { cloudName: '', apiKey: 'key', apiSecret: '' } })
            )

        expect(parse).toThrow(/NUXT_DATABASE_URL/)
        expect(parse).toThrow(/NUXT_CLOUDINARY_CLOUD_NAME/)
        expect(parse).toThrow(/NUXT_CLOUDINARY_API_SECRET/)
    })
})
