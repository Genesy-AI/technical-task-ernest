export type LeadsEnrichPhonesInput = {
  leadIds: number[]
}

// The endpoint only starts the searches; progress arrives through the leads list (phoneEnrichmentStatus).
export type LeadsEnrichPhonesOutput = {
  started: number[]
  alreadyRunning: number[]
  skipped: number[]
  errors: Array<{ leadId: number; error: string }>
}
