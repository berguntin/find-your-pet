import { getRouterParam, readBody } from 'h3'
import { petIdSchema, updatePetSchema } from '../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../container'
import { toPetDto } from '../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../shared/infrastructure/http'

/** For now the only allowed change is marking the pet as reunited with its family. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    parseWith(updatePetSchema, await readBody(event))

    const pet = await pets.markAsReunited.execute(id.data, await getActor(event, adminAccess))
    processOutboxInBackground()
    return toPetDto(pet)
})
