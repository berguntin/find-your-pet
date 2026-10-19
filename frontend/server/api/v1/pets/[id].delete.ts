import { getRouterParam, setResponseStatus } from 'h3'
import { petIdSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { NotFoundError } from '../../../shared/domain/errors'
import { defineApiHandler, getActor } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, config } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')

    await pets.delete.execute(id.data, getActor(event, config.adminToken))
    setResponseStatus(event, 204)
    return null
})
