import { describe, expect, it } from 'vitest'
import { assertAgentAuthorized } from '../src/services/auth'
import { HttpError } from '../src/errors'

describe('assertAgentAuthorized', () => {
    it('authorizes key from AGENT_API_KEYS', () => {
        expect(() => {
            assertAgentAuthorized('k2', { AGENT_API_KEYS: 'k1,k2,k3' })
        }).not.toThrow()
    })

    it('authorizes key from AGENT_API_KEY fallback', () => {
        expect(() => {
            assertAgentAuthorized('single', { AGENT_API_KEY: 'single' })
        }).not.toThrow()
    })

    it('throws unauthorized on mismatch', () => {
        try {
            assertAgentAuthorized('bad', { AGENT_API_KEYS: 'k1,k2' })
            throw new Error('expected error not thrown')
        } catch (err) {
            expect(err).toBeInstanceOf(HttpError)
            expect((err as HttpError).status).toBe(401)
        }
    })
})
