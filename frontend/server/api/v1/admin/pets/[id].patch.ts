import { getRouterParam, readBody } from 'h3'
import { adminUpdatePetSchema } from '../../../../../contracts/admin'
import { petIdSchema } from '../../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../../container'
import { toAdminPetDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../../shared/infrastructure/http'

/** Corrects any detail of a pet, its photos or its resolution. Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const actor = await getActor(event, adminAccess)
    if (actor.kind !== 'admin') throw new ForbiddenError()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    const update = parseWith(adminUpdatePetSchema, await readBody(event))

    const pet = await pets.update.execute(id.data, update, actor)
    processOutboxInBackground()
    return toAdminPetDto(pet)
})
