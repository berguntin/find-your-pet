import { getRouterParam } from 'h3'
import { petIdSchema } from '../../../../../contracts/pets'
import { useContainer } from '../../../../container'
import { toSightingListDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, getActor } from '../../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, access } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')

    return toSightingListDto(await pets.listSightings.execute(id.data, await getActor(event, access)))
})
