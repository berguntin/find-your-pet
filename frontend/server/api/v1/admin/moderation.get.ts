import { getQuery } from 'h3'
import { adminStatsQuerySchema } from '../../../../contracts/admin'
import { useContainer } from '../../../container'
import { toModerationOverviewDto } from '../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, getActor, parseWith } from '../../../shared/infrastructure/http'

/** Automatic moderator setup, its decisions for the last `days` and the latest decisions. Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const { days } = parseWith(adminStatsQuerySchema, getQuery(event))
    return toModerationOverviewDto(await pets.moderationOverview.execute(days, await getActor(event, adminAccess)))
})
