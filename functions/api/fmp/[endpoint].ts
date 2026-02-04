const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

const ALLOWED_ENDPOINTS = new Set([
    'search-name',
    'profile',
    'income-statement',
    'cash-flow-statement',
    'balance-sheet-statement',
    'analyst-estimates',
    'key-metrics',
    'treasury-rates',
    'market-risk-premium'
])

type FmpEnv = {
    FMP_API_KEY?: string
}

export const onRequestGet = async (context: {
    request: Request
    env: FmpEnv
    params: { endpoint?: string }
}): Promise<Response> => {
    const corsHeaders = buildCorsHeaders(context.request)

    const endpoint = context.params.endpoint
    if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
        return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const apiKey = context.env.FMP_API_KEY
    if (!apiKey) {
        return new Response('Missing FMP_API_KEY', { status: 500, headers: corsHeaders })
    }

    const incomingUrl = new URL(context.request.url)
    const targetUrl = new URL(`${FMP_BASE_URL}/${endpoint}`)

    incomingUrl.searchParams.forEach((value, key) => {
        if (key.toLowerCase() === 'apikey') return
        targetUrl.searchParams.append(key, value)
    })

    targetUrl.searchParams.set('apikey', apiKey)

    const upstream = await fetch(targetUrl.toString(), {
        headers: {
            accept: context.request.headers.get('accept') ?? 'application/json'
        }
    })

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    headers.set('cache-control', 'public, max-age=300')
    corsHeaders.forEach((value, key) => {
        headers.set(key, value)
    })

    return new Response(upstream.body, {
        status: upstream.status,
        headers
    })
}

export const onRequestOptions = async (context: {
    request: Request
}): Promise<Response> => {
    return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(context.request)
    })
}

function buildCorsHeaders(request: Request): Headers {
    const headers = new Headers()
    const origin = request.headers.get('origin')
    const allowlist = new Set([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174'
    ])

    if (origin && allowlist.has(origin)) {
        headers.set('access-control-allow-origin', origin)
        headers.set('vary', 'Origin')
    }

    headers.set('access-control-allow-methods', 'GET, OPTIONS')
    headers.set('access-control-allow-headers', request.headers.get('access-control-request-headers') ?? 'Content-Type')
    headers.set('access-control-max-age', '86400')

    return headers
}
