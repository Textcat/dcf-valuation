# dcf-agent-api

Cloudflare Worker backend for agent-friendly DCF valuation.

## Features
- `POST /v1/valuation`: aggregated DCF + Layer B/C + Monte Carlo
- Multi-key auth (`AGENT_API_KEYS` with `AGENT_API_KEY` fallback)
- OpenAPI endpoints (`/openapi.json`, `/openapi.yaml`)
- Core valuation logic imported from `@textcat/dcf-core`

## Local Setup
```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Required env vars:
- `FMP_API_KEY`
- `AGENT_API_KEYS` (or `AGENT_API_KEY`)

## Test
```bash
npm test
```

## OpenAPI
```bash
npm run openapi:generate
```
