# DCF Agent API 使用说明

## 1. 概述
`dcf-agent-api` 提供 AI agent 友好的聚合估值接口：
- 三种终值模式 DCF：`perpetuity` / `roic-driven` / `fade`
- Layer B（结构一致性）+ Layer C（市场隐含）验证
- Monte Carlo 模拟（默认每种终值 3000 次）

## 2. 鉴权
请求头必须带：
- `x-agent-key: <your-key>`

服务端按优先级读取：
1. `AGENT_API_KEYS`（逗号分隔，多 key）
2. `AGENT_API_KEY`（单 key 回退）

## 3. 主要接口
- `POST /v1/valuation`
- `GET /healthz`
- `GET /openapi.json`
- `GET /openapi.yaml`

## 4. 请求示例
```bash
curl -X POST "https://<your-worker-domain>/v1/valuation" \
  -H "Content-Type: application/json" \
  -H "x-agent-key: <your-agent-key>" \
  -d '{
    "symbol": "AAPL",
    "overrides": {
      "dcf": {
        "wacc": 0.095,
        "drivers": [
          { "year": 2, "operatingMargin": 0.24 }
        ]
      },
      "monteCarlo": {
        "iterations": 4000
      }
    },
    "options": {
      "includeDistribution": false
    }
  }'
```

## 5. 默认行为
- 若不传 `overrides`，系统自动使用预填参数。
- `iterations` 默认 `3000`，最大 `20000`（超出自动钳制并写入 `warnings`）。
- `includeDistribution` 默认 `false`（只返回分位数摘要）。
- 若 `terminalGrowthRate >= wacc`，自动下修并写入 `warnings`。

## 6. 错误码
- `400` 请求格式错误
- `401` 鉴权失败
- `404` 股票数据不存在
- `422` 参数组合不可计算
- `500` 服务内部错误

## 7. OpenAPI
规范文件路径：
- `openapi/openapi.yaml`
- `openapi/openapi.json`

可用脚本刷新：
```bash
npm run openapi:generate
```
