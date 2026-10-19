import { readBody, setResponseStatus } from 'h3'
import { reportPetSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetDto } from '../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, getActor, parseWith } from '../../../shared/infrastructure/http'

export default defineApiHandler(async event => {
    const { pets, config } = useContainer()
    const data = parseWith(reportPetSchema, await readBody(event))
    const pet = await pets.report.execute(data, getActor(event, config.adminToken))

    setResponseStatus(event, 201)
    return toPetDto(pet)
})
