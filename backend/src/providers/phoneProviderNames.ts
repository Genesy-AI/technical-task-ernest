// Kept free of I/O imports so the workflow sandbox can import it.

// Order in which the workflow asks providers for a phone number.
export const PHONE_PROVIDER_ORDER = ['orionConnect', 'astraDialer', 'nimbusLookup'] as const

export type PhoneProviderName = (typeof PHONE_PROVIDER_ORDER)[number]

export const PHONE_PROVIDER_LABELS: Record<PhoneProviderName, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

// Per-attempt timeout in milliseconds. Orion is described as slow, so it gets more time.
export const PHONE_PROVIDER_TIMEOUT_MS: Record<PhoneProviderName, number> = {
  orionConnect: 10_000,
  astraDialer: 5_000,
  nimbusLookup: 5_000,
}
