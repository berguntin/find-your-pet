import { getQuery } from 'h3'
import type { AdminSightingListDto } from '../../../../../contracts/sightings'
import { adminSightingsQuerySchema } from '../../../../../contracts/sightings'
import { useContainer } from '../../../../container'
import { toAdminSightingDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, getActor, parseWith } from '../../../../shared/infrastructure/http'

/** Sightings by moderation status (pending review by default), with their scores. Admin only. */
export default defineApiHandler(async (event): Promise<AdminSightingListDto> => {
    const { pets, access } = useContainer()
    const { status } = parseWith(adminSightingsQuerySchema, getQuery(event))

    const sightings = await pets.listSightingsForModeration.execute(status, await getActor(event, access))
    return { items: sightings.map(toAdminSightingDto) }
})
