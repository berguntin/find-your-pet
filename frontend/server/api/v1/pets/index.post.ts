import { readBody, setResponseStatus } from 'h3'
import { reportPetSchema } from '../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../container'
import { toPetDto } from '../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit, getActor, parseWith } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, adminAccess, rateLimiter } = useContainer()
    const data = parseWith(reportPetSchema, await readBody(event))
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.reportPet)
    const pet = await pets.report.execute(data, await getActor(event, adminAccess))
    processOutboxInBackground()

    setResponseStatus(event, 201)
    return toPetDto(pet)
})
