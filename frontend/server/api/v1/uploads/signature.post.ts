import type { UploadAuthorizationDto } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { defineApiHandler } from '../../../shared/infrastructure/http'

export default defineApiHandler((): UploadAuthorizationDto => useContainer().pets.authorizeImageUpload.execute())
