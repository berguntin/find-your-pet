import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { moderatePetSchema, petIdSchema } from '../../../../../../contracts/pets'
import { processOutboxInBackground, useContainer } from '../../../../../container'
import { toPetDto } from '../../../../../modules/pets/infrastructure/http/presenter'
import { NotFoundError } from '../../../../../shared/domain/errors'
import { defineApiHandler, getActor, parseWith } from '../../../../../shared/infrastructure/http'

/** Publishes a report left for review, or rejects it (deleting it and its images). Admin only. */
export default defineApiHandler(async event => {
    const { pets, config } = useContainer()
    const id = petIdSchema.safeParse(getRouterParam(event, 'id'))
    if (!id.success) throw new NotFoundError('Pet not found')
    const { status } = parseWith(moderatePetSchema, await readBody(event))

    const pet = await pets.moderate.execute(id.data, status, getActor(event, config.adminToken))
    if (!pet) {
        setResponseStatus(event, 204)
        return null
    }
    processOutboxInBackground()
    return toPetDto(pet)
})
