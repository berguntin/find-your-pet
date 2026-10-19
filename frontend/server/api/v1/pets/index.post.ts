import { readBody, setResponseStatus } from 'h3'
import { reportPetSchema } from '../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../container'
import { toPetDto } from '../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit, getActor, parseWith } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, config, rateLimiter } = useContainer()
    const data = parseWith(reportPetSchema, await readBody(event))
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.reportPet)
    const pet = await pets.report.execute(data, getActor(event, config.adminToken))
    processOutboxInBackground()

    setResponseStatus(event, 201)
    return toPetDto(pet)
})
