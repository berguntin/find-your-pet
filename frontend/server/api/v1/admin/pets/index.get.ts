import { getQuery } from 'h3'
import { adminListPetsQuerySchema } from '../../../../../contracts/admin'
import { useContainer } from '../../../../container'
import { toAdminPetPageDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, getActor, parseWith } from '../../../../shared/infrastructure/http'

/** Reports by moderation status (pending review by default, `all` for every pet). Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const { q, ...filters } = parseWith(adminListPetsQuerySchema, getQuery(event))
    const page = await pets.listForModeration.execute(
        { ...filters, query: q || undefined },
        await getActor(event, adminAccess)
    )
    return toAdminPetPageDto(page)
})
