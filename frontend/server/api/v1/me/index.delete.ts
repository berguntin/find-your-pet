import { readBody, setResponseStatus } from 'h3'
import { deleteAccountSchema } from '../../../../contracts/users'
import { useContainer } from '../../../container'
import { RATE_LIMITS } from '../../../shared/application/rateLimit'
import { defineApiHandler, enforceRateLimit, parseWith, UnauthorizedError } from '../../../shared/infrastructure/http'

/**
 * Right to erasure: deletes the account (and, if asked, every report it created) and signs out. Works from
 * the raw session, so a device whose account was already deleted elsewhere can still sign out.
 */
export default defineApiHandler(async event => {
    const { access, users, pets, rateLimiter } = useContainer()
    const userId = (await access.session(event))?.userId
    if (!userId) throw new UnauthorizedError()
    const { deletePets } = parseWith(deleteAccountSchema, (await readBody(event)) ?? {})
    await enforceRateLimit(event, rateLimiter, RATE_LIMITS.deleteAccount)

    if (deletePets) await pets.deleteAllOfOwner.execute(userId)
    await users.deleteAccount.execute(userId)
    await access.endSession(event)
    setResponseStatus(event, 204)
    return null
})
