import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { moderatePetSchema } from '../../../../../../contracts/admin'
import { sightingIdSchema } from '../../../../../../contracts/sightings'
import { processOutboxInBackground, useContainer } from '../../../../../container'
import { toAdminSightingDto } from '../../../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../../../shared/infrastructure/http'

/** Publishes a sighting, hides it back to review, or rejects it (deleting it and its images). Admin only. */
export default defineApiHandler(async event => {
    const { pets, access } = useContainer()
    const id = sightingIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Sighting not found')
    const { status } = parseWith(moderatePetSchema, await readBody(event))

    const sighting = await pets.moderateSighting.execute(id.data, status, await getActor(event, access))
    if (!sighting) {
        setResponseStatus(event, 204)
        return null
    }
    processOutboxInBackground()
    return toAdminSightingDto(sighting)
})
