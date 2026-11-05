import { FetchError } from 'ofetch'
import { describe, expect, it } from 'vitest'
import { apiErrorCode } from './apiError'

const fetchError = (data: unknown) => Object.assign(new FetchError('Request failed'), { data })

describe('apiErrorCode', () => {
    it('reads the code of an API error', () => {
        expect(apiErrorCode(fetchError({ error: { code: 'rate_limited', message: 'Slow down' } }))).toBe('rate_limited')
    })

    it('ignores responses without the API error format', () => {
        expect(apiErrorCode(fetchError('<html>Bad gateway</html>'))).toBeUndefined()
        expect(apiErrorCode(fetchError(undefined))).toBeUndefined()
    })

    it('ignores errors that are not failed requests', () => {
        expect(apiErrorCode(new Error('boom'))).toBeUndefined()
    })
})
