import { joinURL } from 'ufo'

export default defineEventHandler(async event => {
    const runtimeConfig = useRuntimeConfig()

    const proxyUrl = runtimeConfig.apiBase

    const path = event.path.replace(/^\/api\//, '')

    const target = joinURL(proxyUrl, path)

    return proxyRequest(event, target)
})
