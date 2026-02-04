import { onRequestGet as __api_fmp__endpoint__ts_onRequestGet } from "/Users/luiyezheng/.codex/worktrees/d774/dcf-valuation/functions/api/fmp/[endpoint].ts"
import { onRequestOptions as __api_fmp__endpoint__ts_onRequestOptions } from "/Users/luiyezheng/.codex/worktrees/d774/dcf-valuation/functions/api/fmp/[endpoint].ts"

export const routes = [
    {
      routePath: "/api/fmp/:endpoint",
      mountPath: "/api/fmp",
      method: "GET",
      middlewares: [],
      modules: [__api_fmp__endpoint__ts_onRequestGet],
    },
  {
      routePath: "/api/fmp/:endpoint",
      mountPath: "/api/fmp",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_fmp__endpoint__ts_onRequestOptions],
    },
  ]