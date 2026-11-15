import { FC } from 'react'
import { PhoneEnrichmentStatus } from '../api/types/leads/getMany'

// Must match the provider names the backend stores in phoneEnrichmentProvider.
const PROVIDER_LABELS: Record<string, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

const providerLabel = (provider: string | null) =>
  provider ? (PROVIDER_LABELS[provider] ?? provider) : null

interface PhoneCellProps {
  phoneNumber: string | null
  status: PhoneEnrichmentStatus | null
  provider: string | null
}

export const PhoneCell: FC<PhoneCellProps> = ({ phoneNumber, status, provider }) => {
  const label = providerLabel(provider)

  if (status === 'IN_PROGRESS') {
    return (
      <div className="flex items-center text-sm text-blue-600">
        <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span>{label ? `Searching (${label})...` : 'Searching...'}</span>
      </div>
    )
  }

  if (phoneNumber) {
    return (
      <div
        className="text-sm text-gray-900"
        title={status === 'FOUND' && label ? `Found by ${label}` : undefined}
      >
        {phoneNumber}
      </div>
    )
  }

  if (status === 'NOT_FOUND') return <div className="text-sm text-gray-500 italic">No data found</div>
  if (status === 'FAILED') return <div className="text-sm text-red-600">Lookup failed</div>

  return <div className="text-sm text-gray-900">-</div>
}
