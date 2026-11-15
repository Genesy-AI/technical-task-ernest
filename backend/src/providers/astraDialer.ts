import { nonEmptyString, postJson, requireApiKey } from './http'
import { PHONE_PROVIDER_LABELS, PHONE_PROVIDER_TIMEOUT_MS } from './phoneProviderNames'
import { PhoneProvider } from './types'

const URL = 'https://api.enginy.ai/api/tmp/astraDialer'
const label = PHONE_PROVIDER_LABELS.astraDialer

export const astraDialer: PhoneProvider = {
  name: 'astraDialer',
  async lookup(lead) {
    const response = (await postJson({
      provider: label,
      url: URL,
      headers: { apiKey: requireApiKey(label, 'ASTRA_DIALER_API_KEY') },
      body: { email: lead.email },
      timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.astraDialer,
    })) as { phoneNmbr?: unknown }

    return nonEmptyString(response?.phoneNmbr)
  },
}
