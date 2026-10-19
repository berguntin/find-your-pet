import { waitUntil } from '@vercel/functions'
import { consola } from 'consola'

/**
 * Runs work after the response is sent. On Vercel the function stays alive until the promise settles;
 * elsewhere the promise simply keeps running. Failures are logged, never thrown at the caller.
 */
export function runInBackground(task: () => Promise<unknown>, name: string): void {
    const promise = task().catch(error => consola.error(`Background task "${name}" failed`, error))
    waitUntil(promise)
}
