import { Client, Connection } from '@temporalio/client'

let clientPromise: Promise<Client> | undefined

// Reuse one connection for every request instead of opening a new one each time.
export function getTemporalClient(): Promise<Client> {
  clientPromise ??= Connection.connect({ address: 'localhost:7233' })
    .then((connection) => new Client({ connection, namespace: 'default' }))
    .catch((error) => {
      clientPromise = undefined
      throw error
    })
  return clientPromise
}
