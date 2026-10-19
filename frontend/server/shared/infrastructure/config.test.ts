import { describe, expect, it } from 'vitest'
import { parseServerConfig, withRawSecrets } from './config'

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

describe('numeric values', () => {
    it('accepts secrets that Nuxt parsed as numbers', () => {
        const config = parseServerConfig(
            runtimeConfig({ cloudinary: { cloudName: 'cloud', apiKey: 123456789012345, apiSecret: 'secret' } })
        )

        expect(config.cloudinary.apiKey).toBe('123456789012345')
    })

    it('accepts numeric optional values too', () => {
        expect(parseServerConfig(runtimeConfig({ adminToken: 42 })).adminToken).toBe('42')
    })
})

describe('withRawSecrets', () => {
    it('reads secrets exactly as written in the environment', () => {
        // Nuxt would have turned this into 9007199254740992, losing the last digit.
        const raw = withRawSecrets(
            runtimeConfig({ cloudinary: { cloudName: 'cloud', apiKey: 9007199254740992, apiSecret: 'secret' } }),
            {
                NUXT_CLOUDINARY_API_KEY: '9007199254740993',
                NUXT_ADMIN_TOKEN: '000123',
                NUXT_GEMINI_API_KEY: 'AIza-gemini'
            }
        )

        const config = parseServerConfig(raw)
        expect(config.cloudinary.apiKey).toBe('9007199254740993')
        expect(config.adminToken).toBe('000123')
        expect(config.cloudinary.apiSecret).toBe('secret')
        expect(config.gemini.apiKey).toBe('AIza-gemini')
    })

    it('keeps runtime config values that are not in the environment', () => {
        const config = parseServerConfig(withRawSecrets(runtimeConfig(), {}))

        expect(config.cloudinary).toMatchObject({ cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret' })
        expect(config.databaseUrl).toBe('postgres://localhost/pets')
    })

    it('reads CRON_SECRET and the Upstash integration variables', () => {
        const config = parseServerConfig(
            withRawSecrets(runtimeConfig(), {
                CRON_SECRET: 'cron',
                UPSTASH_REDIS_REST_URL: 'https://redis.test',
                UPSTASH_REDIS_REST_TOKEN: 'redis-token'
            })
        )

        expect(config.cronSecret).toBe('cron')
        expect(config.upstash).toEqual({ url: 'https://redis.test', token: 'redis-token' })
    })

    it('prefers NUXT_UPSTASH_* over the integration variables', () => {
        const config = parseServerConfig(
            withRawSecrets(runtimeConfig(), {
                NUXT_UPSTASH_URL: 'https://mine.test',
                NUXT_UPSTASH_TOKEN: 'mine',
                UPSTASH_REDIS_REST_URL: 'https://integration.test',
                UPSTASH_REDIS_REST_TOKEN: 'integration'
            })
        )

        expect(config.upstash).toEqual({ url: 'https://mine.test', token: 'mine' })
    })
})
