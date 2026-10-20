import { useContainer } from '../../../container'
import { defineApiHandler, requireBearerToken } from '../../../shared/infrastructure/http'

/** Indexes published pets missing from the search index. Called by the scheduled workflow and Vercel Cron. */
export default defineApiHandler(async event => {
    const { config, pets } = useContainer()
    requireBearerToken(event, [config.internalToken, config.cronSecret])
    return pets.backfillSearchIndex.execute()
})
