import { HttpError } from '../errors'

export interface AuthEnv {
    AGENT_API_KEYS?: string
    AGENT_API_KEY?: string
}

function secureCompare(left: string, right: string): boolean {
    const maxLen = Math.max(left.length, right.length)
    let diff = left.length ^ right.length

    for (let i = 0; i < maxLen; i++) {
        const leftCode = i < left.length ? left.charCodeAt(i) : 0
        const rightCode = i < right.length ? right.charCodeAt(i) : 0
        diff |= leftCode ^ rightCode
    }

    return diff === 0
}

function parseAllowedKeys(env: AuthEnv): string[] {
    if (env.AGENT_API_KEYS && env.AGENT_API_KEYS.trim().length > 0) {
        return env.AGENT_API_KEYS
            .split(',')
            .map(key => key.trim())
            .filter(Boolean)
    }

    if (env.AGENT_API_KEY && env.AGENT_API_KEY.trim().length > 0) {
        return [env.AGENT_API_KEY.trim()]
    }

    return []
}

export function assertAgentAuthorized(headerValue: string | null, env: AuthEnv): void {
    const allowedKeys = parseAllowedKeys(env)
    if (allowedKeys.length === 0) {
        throw new HttpError(500, 'auth_not_configured', 'Agent auth keys are not configured')
    }

    if (!headerValue || headerValue.trim().length === 0) {
        throw new HttpError(401, 'unauthorized', 'Missing x-agent-key header')
    }

    const incoming = headerValue.trim()
    const matched = allowedKeys.some(allowed => secureCompare(incoming, allowed))

    if (!matched) {
        throw new HttpError(401, 'unauthorized', 'Invalid x-agent-key')
    }
}
