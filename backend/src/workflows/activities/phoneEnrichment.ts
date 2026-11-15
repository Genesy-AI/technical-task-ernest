import { prisma } from '../../db'
import { phoneProviders, PhoneLookupLead, PhoneProviderName } from '../../providers'
import type { PhoneEnrichmentProgress } from '../phoneEnrichment'

// Returns null when the lead was deleted after the workflow started.
export async function loadLeadForPhoneEnrichment(leadId: number): Promise<PhoneLookupLead | null> {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true, companyName: true },
  })
}

export async function lookupPhone(
  provider: PhoneProviderName,
  lead: PhoneLookupLead
): Promise<string | null> {
  return phoneProviders[provider].lookup(lead)
}

export async function savePhoneEnrichment(leadId: number, update: PhoneEnrichmentProgress): Promise<void> {
  // updateMany does not throw when the lead was deleted mid-run.
  await prisma.lead.updateMany({
    where: { id: leadId },
    data: {
      phoneEnrichmentStatus: update.status,
      phoneEnrichmentProvider: update.provider,
      ...(update.phone ? { phoneNumber: update.phone } : {}),
    },
  })
}
