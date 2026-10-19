import { useContainer } from '../../../container'
import { defineApiHandler, requireBearerToken } from '../../../shared/infrastructure/http'

/** Deletes uploads older than a day that no pet references. Called by the scheduled workflow and Vercel Cron. */
export default defineApiHandler(async event => {
    const { config, pets } = useContainer()
    requireBearerToken(event, [config.internalToken, config.cronSecret])
    return pets.cleanUpOrphanImages.execute()
})
