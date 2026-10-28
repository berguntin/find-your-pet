import { getRouterParam, setResponseStatus } from 'h3'
import { petIdSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { NotFoundError } from '../../../shared/domain/errors'
import { defineApiHandler, getActor } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')

    await pets.delete.execute(id.data, await getActor(event, adminAccess))
    setResponseStatus(event, 204)
    return null
})
