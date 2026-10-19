import { getRouterParam, readBody } from 'h3'
import { petIdSchema, updatePetSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetDto } from '../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../shared/infrastructure/http'

/** For now the only allowed change is marking the pet as reunited with its family. */
export default defineApiHandler(async event => {
    const { pets, config } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    parseWith(updatePetSchema, await readBody(event))

    return toPetDto(await pets.markAsReunited.execute(id.data, getActor(event, config.adminToken)))
})
