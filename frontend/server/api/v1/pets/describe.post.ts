import { readBody } from 'h3'
import { describePetSchema } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { toPetDescriptionDto } from '../../../modules/pets/infrastructure/http/presenter'
import { defineApiHandler, parseWith } from '../../../shared/infrastructure/http'

/** Pre-fills the report form from a photo or poster. */
export default defineApiHandler(async event => {
    const { image } = parseWith(describePetSchema, await readBody(event))
    return toPetDescriptionDto(await useContainer().pets.describe.execute(image))
})
