import type { UploadAuthorizationDto } from '../../../../contracts/pets'
import { useContainer } from '../../../container'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit } from '../../../shared/infrastructure/http'

export default defineApiHandler(async (event): Promise<UploadAuthorizationDto> => {
    const { pets, rateLimiter } = useContainer()
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.uploadSignature)
    return pets.authorizeImageUpload.execute()
})
