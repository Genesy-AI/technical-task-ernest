import { astraDialer } from './astraDialer'
import { nimbusLookup } from './nimbusLookup'
import { orionConnect } from './orionConnect'
import { PhoneProviderName } from './phoneProviderNames'
import { PhoneProvider } from './types'

// One adapter per provider. To add a provider: write its adapter, register it here and add its name to
// PHONE_PROVIDER_ORDER.
export const phoneProviders: Record<PhoneProviderName, PhoneProvider> = {
  orionConnect,
  astraDialer,
  nimbusLookup,
}

export * from './phoneProviderNames'
export * from './types'
