import { readBody } from 'h3'
import { describePetSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetDescriptionDto } from '../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit, parseWith } from '../../../shared/infrastructure/http'

/** Pre-fills the report form from a photo or poster. */
export default defineApiHandler(async event => {
    const { pets, rateLimiter } = useContainer()
    const { image } = parseWith(describePetSchema, await readBody(event))
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.describe)
    return toPetDescriptionDto(await pets.describe.execute(image))
})
