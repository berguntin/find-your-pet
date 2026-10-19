import { getQuery } from 'h3'
import { adminListPetsQuerySchema } from '../../../../../contracts/pets'
import { useContainer } from '../../../../container'
import { toPetPageDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, getActor, parseWith } from '../../../../shared/infrastructure/http'

/** Reports by moderation status (pending review by default). Admin only. */
export default defineApiHandler(async event => {
    const { pets, config } = useContainer()
    const { q, ...filters } = parseWith(adminListPetsQuerySchema, getQuery(event))
    const page = await pets.listForModeration.execute(
        { ...filters, query: q || undefined },
        getActor(event, config.adminToken)
    )
    return toPetPageDto(page)
})
