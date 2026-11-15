import { PrismaClient } from '@prisma/client'

// One client for the API routes and the Temporal activities, which run in the same process.
export const prisma = new PrismaClient()
