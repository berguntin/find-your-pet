import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { moderatePetSchema } from '../../../../../../contracts/admin'
import { petIdSchema } from '../../../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../../../container'
import { toAdminPetDto } from '../../../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../../../shared/infrastructure/http'

/** Publishes a report, hides a published one back to review, or rejects it (deleting it and its images). Admin only. */
export default defineApiHandler(async event => {
    const { pets, adminAccess } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    const { status } = parseWith(moderatePetSchema, await readBody(event))

    const pet = await pets.moderate.execute(id.data, status, await getActor(event, adminAccess))
    if (!pet) {
        setResponseStatus(event, 204)
        return null
    }
    processOutboxInBackground()
    return toAdminPetDto(pet)
})
