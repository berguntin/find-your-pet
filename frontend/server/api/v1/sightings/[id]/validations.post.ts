import { getRouterParam } from 'h3'
import { sightingIdSchema } from '../../../../../contracts/sightings'
import { processOutboxInBackground, useContainer } from '../../../../container'
import { toSightingDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { RATE_LIMITS } from '../../../../shared/application/rateLimit'
import { NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, enforceRateLimit, requireSignedIn } from '../../../../shared/infrastructure/http'

/** "I saw it too" (1 point) or, from the pet's owner, "it is my pet" (enough to verify it). */
export default defineApiHandler(async event => {
    const { pets, access, rateLimiter } = useContainer()
    const id = sightingIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Sighting not found')
    const { actor, userId } = await requireSignedIn(event, access)
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.validateSighting, `user:${userId}`)
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.validateSightingFromIp)

    const sighting = await pets.validateSighting.execute(id.data, actor)
    processOutboxInBackground()
    return toSightingDto({
        sighting,
        authorName: null,
        viewer: { isAuthor: false, hasValidated: true, canValidate: false, canHide: false }
    })
})
