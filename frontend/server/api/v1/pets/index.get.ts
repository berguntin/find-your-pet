import { getQuery } from 'h3'
import { listPetsQuerySchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetPageDto } from '../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, parseWith } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { q, ...filters } = parseWith(listPetsQuerySchema, getQuery(event))
    const page = await useContainer().pets.list.execute({ ...filters, query: q || undefined })
    return toPetPageDto(page)
})
