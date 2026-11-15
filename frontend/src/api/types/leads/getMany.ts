export type LeadsGetManyInput = undefined

export type PhoneEnrichmentStatus = 'IN_PROGRESS' | 'FOUND' | 'NOT_FOUND' | 'FAILED'

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerified: boolean | null
  phoneNumber: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
  phoneEnrichmentStatus: PhoneEnrichmentStatus | null
  // Provider being searched while IN_PROGRESS, or the one that found the phone
  phoneEnrichmentProvider: string | null
}[]
