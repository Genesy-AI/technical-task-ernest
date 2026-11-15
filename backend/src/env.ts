import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Load backend/.env (provider API keys) without a dotenv dependency. Variables already set win.
const envPath = resolve(__dirname, '../.env')
if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}
