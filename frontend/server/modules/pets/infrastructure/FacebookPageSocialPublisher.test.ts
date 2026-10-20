import { describe, expect, it, vi } from 'vitest'
import { FacebookApiError, FacebookPageSocialPublisher } from './FacebookPageSocialPublisher'

const CONFIG = { pageId: '1234567890123456789', pageToken: 'page-token', graphVersion: 'v24.0' }

interface Call {
    method: string
    url: URL
    params: Record<string, string>
}

/** A fake Graph API: answers each request with the next response and records what was sent. */
function fakeGraph(...responses: Array<{ status?: number; body: unknown }>) {
    const calls: Call[] = []
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input))
        const params = Object.fromEntries(new URLSearchParams(init?.body ? String(init.body) : url.search))
        calls.push({ method: init?.method ?? 'GET', url, params })
        const next = responses.shift() ?? { body: {} }
        return new Response(JSON.stringify(next.body), { status: next.status ?? 200 })
    })
    return { calls, publisher: new FacebookPageSocialPublisher(CONFIG, fetch as typeof globalThis.fetch) }
}

describe('FacebookPageSocialPublisher', () => {
    it('uploads the photos unpublished and attaches them to one post', async () => {
        const { calls, publisher } = fakeGraph(
            { body: { id: 'photo-1' } },
            { body: { id: 'photo-2' } },
            { body: { id: 'page_post-1' } }
        )

        const postId = await publisher.publish({
            message: 'Perro perdido',
            imageUrls: ['https://img/1.jpg', 'https://img/2.jpg']
        })

        expect(postId).toBe('page_post-1')
        expect(calls.map(c => [c.method, c.url.pathname])).toEqual([
            ['POST', `/v24.0/${CONFIG.pageId}/photos`],
            ['POST', `/v24.0/${CONFIG.pageId}/photos`],
            ['POST', `/v24.0/${CONFIG.pageId}/feed`]
        ])
        expect(calls[0]!.params).toEqual({ url: 'https://img/1.jpg', published: 'false', access_token: 'page-token' })
        expect(calls[2]!.params).toEqual({
            message: 'Perro perdido',
            'attached_media[0]': '{"media_fbid":"photo-1"}',
            'attached_media[1]': '{"media_fbid":"photo-2"}',
            access_token: 'page-token'
        })
        // The token travels in the body, never in the URL, on POST requests.
        expect(calls.every(c => !c.url.search)).toBe(true)
    })

    it('edits the message of a post', async () => {
        const { calls, publisher } = fakeGraph({ body: { success: true } })

        await publisher.updateMessage('page_post-1', '✅ En casa')

        expect(calls).toEqual([
            {
                method: 'POST',
                url: new URL('https://graph.facebook.com/v24.0/page_post-1'),
                params: { message: '✅ En casa', access_token: 'page-token' }
            }
        ])
    })

    it('deletes a post, and treats a post already gone as deleted', async () => {
        const { calls, publisher } = fakeGraph(
            { body: { success: true } },
            { status: 400, body: { error: { message: 'Object does not exist', code: 100, error_subcode: 33 } } }
        )

        await publisher.remove('page_post-1')
        await publisher.remove('page_post-2')

        expect(calls.map(c => [c.method, c.url.pathname, c.params])).toEqual([
            ['DELETE', '/v24.0/page_post-1', { access_token: 'page-token' }],
            ['DELETE', '/v24.0/page_post-2', { access_token: 'page-token' }]
        ])
    })

    it('throws Graph API errors with their code, pointing out an invalid token', async () => {
        const { publisher } = fakeGraph({
            status: 401,
            body: { error: { message: 'Error validating access token', code: 190 } }
        })

        const error = await publisher.updateMessage('page_post-1', 'x').catch(e => e)

        expect(error).toBeInstanceOf(FacebookApiError)
        expect(error.code).toBe(190)
        expect(error.message).toContain('the Page token is invalid or expired')
        expect(error.message).not.toContain('page-token')
    })

    it('throws when Facebook does not answer with JSON', async () => {
        const fetch = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
        const publisher = new FacebookPageSocialPublisher(CONFIG, fetch as typeof globalThis.fetch)

        await expect(publisher.remove('page_post-1')).rejects.toThrow('failed with 502')
    })
})
