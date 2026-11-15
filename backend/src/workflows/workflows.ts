import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  // Verification can take up to 20 seconds, so each attempt needs more time than that.
  startToCloseTimeout: '30 seconds',
  // Temporal retries activities forever by default; cap it so a failing verification cannot hang the workflow.
  retry: { maximumAttempts: 3 },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
