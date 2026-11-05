import { getQuery } from 'h3'
import { adminStatsQuerySchema } from '../../../../contracts/admin'
import { useContainer } from '../../../container'
import { defineApiHandler, getActor, parseWith } from '../../../shared/infrastructure/http'

/** New lost and found pets per day, reunions and totals, for the last `days`. Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const { days } = parseWith(adminStatsQuerySchema, getQuery(event))
    return pets.stats.execute(days, await getActor(event, adminAccess))
})
