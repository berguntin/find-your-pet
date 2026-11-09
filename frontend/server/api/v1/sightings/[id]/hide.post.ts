import { getRouterParam } from 'h3'
import { sightingIdSchema } from '../../../../../contracts/sightings'
import { useContainer } from '../../../../container'
import { NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, requireSignedIn } from '../../../../shared/infrastructure/http'

/** The pet's owner hides a sighting from their notice until an admin reviews it. */
export default defineApiHandler(async event => {
    const { pets, access } = useContainer()
    const id = sightingIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Sighting not found')
    const { actor } = await requireSignedIn(event, access)

    const sighting = await pets.hideSighting.execute(id.data, actor)
    return { id: sighting.id, moderationStatus: sighting.toSnapshot().moderationStatus }
})
