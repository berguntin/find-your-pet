import { getQuery } from 'h3'
import { listPetsQuerySchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetPageDto } from '../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, isWithinRateLimit, parseWith } from '../../../shared/infrastructure/http'

/**
 * Public listing. With `q`, keyword hits come first followed by semantic matches ("perro negro").
 * Over the semantic rate limit, the search quietly falls back to keywords instead of failing.
 */
export default defineApiHandler(async event => {
    const { pets, rateLimiter } = useContainer()
    const { q, ...filters } = parseWith(listPetsQuerySchema, getQuery(event))
    const query = q || undefined
    const semantic = query !== undefined && (await isWithinRateLimit(event, rateLimiter, RATE_LIMITS.semanticSearch))

    return toPetPageDto(await pets.search.execute({ ...filters, query }, { semantic }))
})
