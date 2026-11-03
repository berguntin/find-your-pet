import { getRouterParam } from 'h3'
import { petIdSchema } from '../../../../../contracts/pets'
import { useContainer } from '../../../../container'
import { toAdminPetDto } from '../../../../modules/pets/infrastructure/http/presenter'
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors'
import { defineApiHandler, getActor } from '../../../../shared/infrastructure/http'

/** Any pet, published or not, with its moderation details. Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const actor = await getActor(event, adminAccess)
    if (actor.kind !== 'admin') throw new ForbiddenError()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')

    return toAdminPetDto(await pets.get.execute(id.data, actor))
})
