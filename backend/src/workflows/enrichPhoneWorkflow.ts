import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'
import {
  PHONE_PROVIDER_ORDER,
  PHONE_PROVIDER_TIMEOUT_MS,
  PhoneProviderName,
} from '../providers/phoneProviderNames'
import { PhoneEnrichmentResult, runPhoneEnrichment } from './phoneEnrichment'

const { loadLeadForPhoneEnrichment, savePhoneEnrichment } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 5 },
})

// Each provider gets its own short timeout and the same bounded retry policy: 3 attempts, 1s then 2s apart.
// The activity's own HTTP timeout fires first; the extra margin covers the activity's startup.
const providerActivities = Object.fromEntries(
  PHONE_PROVIDER_ORDER.map((provider) => [
    provider,
    proxyActivities<typeof activities>({
      startToCloseTimeout: PHONE_PROVIDER_TIMEOUT_MS[provider] + 2_000,
      retry: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        backoffCoefficient: 2,
        // Bad credentials or an invalid request will not succeed on retry.
        nonRetryableErrorTypes: ['ProviderClientError'],
      },
    }),
  ])
) as Record<PhoneProviderName, ReturnType<typeof proxyActivities<typeof activities>>>

export async function enrichPhoneWorkflow(leadId: number): Promise<PhoneEnrichmentResult | null> {
  const lead = await loadLeadForPhoneEnrichment(leadId)
  if (!lead) return null

  return runPhoneEnrichment(lead, PHONE_PROVIDER_ORDER, {
    lookup: (provider, lookupLead) => providerActivities[provider].lookupPhone(provider, lookupLead),
    saveProgress: (update) => savePhoneEnrichment(leadId, update),
  })
}
