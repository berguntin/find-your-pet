import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { petIdSchema } from '../../../../../contracts/pets'
import { reportSightingSchema } from '../../../../../contracts/sightings'
import { processOutboxInBackground, useContainer } from '../../../../container'
import { toSightingDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../../shared/application/rateLimit'
import { NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, enforceRateLimit, parseWith, requireSignedIn } from '../../../../shared/infrastructure/http'

/** Reports a sighting of a pet. Needs an account; moderated like a notice. */
export default defineApiHandler(async event => {
    const { pets, access, rateLimiter } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    const { actor, userId } = await requireSignedIn(event, access)
    const data = parseWith(reportSightingSchema, await readBody(event))
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.reportSighting, `user:${userId}`)
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.reportSightingFromIp)

    const sighting = await pets.reportSighting.execute(id.data, { ...data, seenAt: new Date(data.seenAt) }, actor)
    processOutboxInBackground()
    setResponseStatus(event, 201)
    return toSightingDto({
        sighting,
        authorName: null,
        viewer: { isAuthor: true, hasValidated: false, canValidate: false, canHide: false }
    })
})
