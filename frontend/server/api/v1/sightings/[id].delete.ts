import { getRouterParam, setResponseStatus } from 'h3'
import { sightingIdSchema } from '../../../../contracts/sightings'
import { useContainer } from '../../../container'
import { NotFoundError } from '../../../shared/domain/errors'
import { defineApiHandler, getActor } from '../../../shared/infrastructure/http'

/** The author or an admin deletes a sighting and its photos. */
export default defineApiHandler(async event => {
    const { pets, access } = useContainer()
    const id = sightingIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Sighting not found')

    await pets.deleteSighting.execute(id.data, await getActor(event, access))
    setResponseStatus(event, 204)
    return null
})
