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
        expect(config.gemini).toEqual({ apiKey: undefined, embeddingModel: 'gemini-embedding-2-preview' })
        expect(config.imageSearch).toEqual({ matchFloor: 0.6, matchCeiling: 0.95 })
        expect(config.semanticSearch).toEqual({
            textFloor: 0.55,
            textCeiling: 0.85,
            imageFloor: 0.25,
            imageCeiling: 0.45
        })
    })

    it('rejects a semantic calibration whose ceilings are not above their floors', () => {
        expect(() =>
            parseServerConfig(runtimeConfig({ semanticSearch: { imageFloor: 0.5, imageCeiling: 0.4 } }))
        ).toThrow(/semantic search/)
    })

    it('reads the match calibration from strings, as environment variables are', () => {
        const config = parseServerConfig(runtimeConfig({ imageSearch: { matchFloor: '0.7', matchCeiling: '0.9' } }))

        expect(config.imageSearch).toEqual({ matchFloor: 0.7, matchCeiling: 0.9 })
    })

    it('rejects a calibration whose ceiling is not above its floor', () => {
        expect(() => parseServerConfig(runtimeConfig({ imageSearch: { matchFloor: 0.9, matchCeiling: 0.8 } }))).toThrow(
            /matchCeiling/
        )
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
