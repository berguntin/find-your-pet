import { useContainer } from '../../../container'
import { defineApiHandler, requireBearerToken } from '../../../shared/infrastructure/http'

const MAX_BATCHES = 10

/**
 * Delivers pending outbox events. Called by the scheduled GitHub Actions workflow and by Vercel Cron
 * (GET, with CRON_SECRET), so it accepts any method.
 */
export default defineApiHandler(async event => {
    const { config, processOutbox } = useContainer()
    requireBearerToken(event, [config.internalToken, config.cronSecret])

    const total = { processed: 0, failed: 0 }
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const result = await processOutbox.execute()
        total.processed += result.processed
        total.failed += result.failed
        if (result.processed + result.failed === 0) break
    }
    return total
})
