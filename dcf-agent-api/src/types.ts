import type { AuthEnv } from './services/auth'

export interface WorkerBindings extends AuthEnv {
    FMP_API_KEY?: string
}
