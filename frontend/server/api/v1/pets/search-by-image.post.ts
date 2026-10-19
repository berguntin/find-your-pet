import { readBody } from 'h3'
import { searchByImageSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetMatchListDto } from '../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit, parseWith } from '../../../shared/infrastructure/http'

/** Public, still-open pets that look like the animal in the photo, best match first. */
export default defineApiHandler(async event => {
    const { pets, rateLimiter } = useContainer()
    const { image } = parseWith(searchByImageSchema, await readBody(event))
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.searchByImage)

    const [header, base64 = ''] = image.split(',', 2)
    const mimeType = header!.slice('data:'.length, header!.indexOf(';'))
    const matches = await pets.searchByImage.execute({ mimeType, data: Buffer.from(base64, 'base64') })
    return toPetMatchListDto(matches)
})
