import type { SocialPost, SocialPublisher } from '../application/ports'

export interface FacebookPageConfig {
    pageId: string
    /** Long-lived Page access token with pages_manage_posts. */
    pageToken: string
    /** Graph API version, e.g. 'v24.0'. Pinned so Meta's changes arrive when we choose. */
    graphVersion: string
}

type Fetch = typeof globalThis.fetch

const TIMEOUT_MS = 10_000

/** Graph API error codes worth naming in logs. */
const INVALID_TOKEN = 190
const OBJECT_NOT_FOUND = { code: 100, subcode: 33 }

export class FacebookApiError extends Error {
    constructor(message: string, readonly code: number | null, readonly subcode: number | null) {
        super(message)
        this.name = 'FacebookApiError'
    }

    get isMissingObject(): boolean {
        return this.code === OBJECT_NOT_FOUND.code && this.subcode === OBJECT_NOT_FOUND.subcode
    }
}

/**
 * Publishes on our Facebook Page through the Graph API. Every post is a photo post (Facebook reaches
 * fewer people with link posts): the photos are uploaded unpublished and then attached to one post,
 * which works the same for one photo or several. Errors are thrown so the outbox retries them.
 */
export class FacebookPageSocialPublisher implements SocialPublisher {
    readonly network = 'facebook'

    constructor(private readonly config: FacebookPageConfig, private readonly fetch: Fetch = globalThis.fetch) {}

    async publish(post: SocialPost): Promise<string> {
        const photoIds: string[] = []
        for (const url of post.imageUrls) {
            const photo = await this.request<{ id: string }>('POST', `${this.config.pageId}/photos`, {
                url,
                published: 'false'
            })
            photoIds.push(photo.id)
        }

        const attachments = Object.fromEntries(
            photoIds.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })])
        )
        const created = await this.request<{ id: string }>('POST', `${this.config.pageId}/feed`, {
            message: post.message,
            ...attachments
        })
        return created.id
    }

    async updateMessage(postId: string, message: string): Promise<void> {
        await this.request('POST', postId, { message })
    }

    async remove(postId: string): Promise<void> {
        try {
            await this.request('DELETE', postId, {})
        } catch (error) {
            if (error instanceof FacebookApiError && error.isMissingObject) return
            throw error
        }
    }

    private async request<T>(method: 'POST' | 'DELETE', path: string, params: Record<string, string>): Promise<T> {
        const url = new URL(`https://graph.facebook.com/${this.config.graphVersion}/${path}`)
        const body = new URLSearchParams({ ...params, access_token: this.config.pageToken })
        // The Graph API reads DELETE parameters from the query string.
        if (method === 'DELETE') url.search = body.toString()

        const response = await this.fetch(url, {
            method,
            body: method === 'POST' ? body : undefined,
            signal: AbortSignal.timeout(TIMEOUT_MS)
        })
        const json = (await response.json().catch(() => null)) as
            | (T & { error?: { message?: string; code?: number; error_subcode?: number } })
            | null

        if (!response.ok || !json || json.error) {
            const error = json?.error
            const code = error?.code ?? null
            const hint = code === INVALID_TOKEN ? ' (the Page token is invalid or expired: generate a new one)' : ''
            throw new FacebookApiError(
                `Facebook ${method} ${path} failed with ${response.status}: ${
                    error?.message ?? 'no error message'
                }${hint}`,
                code,
                error?.error_subcode ?? null
            )
        }
        return json
    }
}
