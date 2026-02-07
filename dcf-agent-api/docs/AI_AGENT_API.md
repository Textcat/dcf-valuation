# DCF Agent API Agent 集成说明

## 1. 概述
`dcf-agent-api` 提供 AI agent 友好的聚合估值接口：
- 三种终值模式 DCF：`perpetuity` / `roic-driven` / `fade`
- Layer B（结构一致性）+ Layer C（市场隐含）验证
- Monte Carlo 模拟（默认每种终值 3000 次）

线上服务（Cloudflare Workers）：
- Base URL: `https://dcf-agent-api.luiyezheng.workers.dev`

## 2. 鉴权
请求头必须带：
- `x-agent-key: <your-key>`

服务端按优先级读取：
1. `AGENT_API_KEYS`（逗号分隔，多 key）
2. `AGENT_API_KEY`（单 key 回退）

对 agent 的建议：
- 把 `x-agent-key` 视为机密，仅存储在安全的 secret 管理中，不要写入日志/提示词/前端代码。
- 如果你有多套环境（dev/staging/prod），建议使用不同 key，便于撤销与轮换。

## 3. 主要接口
- `POST /v1/valuation`
- `GET /healthz`
- `GET /openapi.json`
- `GET /openapi.yaml`

完整 URL（线上）：
- `POST https://dcf-agent-api.luiyezheng.workers.dev/v1/valuation`
- `GET  https://dcf-agent-api.luiyezheng.workers.dev/healthz`
- `GET  https://dcf-agent-api.luiyezheng.workers.dev/openapi.json`
- `GET  https://dcf-agent-api.luiyezheng.workers.dev/openapi.yaml`

## 4. 请求与响应（agent 视角）

### 4.1 请求体（JSON）
- `symbol`（string, required）
  - 股票代码（建议传大写）。示例：`"AAPL"`、`"MSFT"`。
- `overrides`（object, optional）
  - `dcf`（object, optional）
    - `wacc`（number, optional）示例：`0.095`
    - `terminalGrowthRate`（number, optional）示例：`0.03`
    - `steadyStateROIC`（number, optional）
    - `explicitPeriodYears`（int, optional, 1..5）
    - `drivers`（array, optional）
      - 每年覆盖项（year = 1..5），可覆盖 `revenueGrowth` / `operatingMargin` / `taxRate` / `daPercent` / `capexPercent` / `wcChangePercent` / `grossMargin` 等。
  - `monteCarlo`（object, optional）
    - `iterations`（int, optional）
      - 默认 `3000`；最大 `20000`（超出会被钳制并写入 `warnings`）。
    - `params`（object, optional）
      - 高级参数透传（依具体实现而定）。
- `options`（object, optional）
  - `includeDistribution`（boolean, optional, default false）
    - `false`：只返回摘要（更快、更省流量）。
    - `true`：返回分布（更大响应体，适合需要做二次统计或可视化的 agent）。

### 4.2 成功响应（200）
响应结构（高层）：
- `meta`
  - `requestId`：每次请求唯一 ID。建议在 agent 的工具调用日志里记录，用于排障。
  - `symbol` / `companyName`
  - `generatedAt`：生成时间字符串
  - `apiVersion` / `coreVersion`
- `effectiveInputs`
  - `dcfInputs`：最终生效的 DCF 输入（包含预填与 overrides 合并结果）
  - `monteCarloByMethod`：每个终值方法的 Monte Carlo 生效参数
- `results`
  - `perpetuity` / `roicDriven` / `fade`
    - `dcf`：该方法的 DCF 结果
    - `layerB`：结构一致性校验结果
    - `monteCarlo`：该方法 Monte Carlo 结果（当 `includeDistribution=false` 时通常不会返回完整分布）
- `validation`
  - `layerC`：市场隐含校验结果
- `warnings`（string[]）
  - 例如：iterations 被钳制、`terminalGrowthRate >= wacc` 被自动下修等。

对 agent 的建议：
- 先以 `results.<method>.dcf.fairValuePerShare` 作为主输出候选（若存在），再结合 `layerB/layerC` 与 `warnings` 给出置信度或解释。
- 如果 `warnings` 非空，输出时应该以要点形式呈现给用户（避免“悄悄修正”造成误解）。

### 4.3 错误响应（4xx/5xx）
错误体格式：
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Invalid x-agent-key",
    "requestId": "....",
    "details": {}
  }
}
```
常见状态码：
- `400`：请求格式错误（比如缺少 `symbol`）
- `401`：鉴权失败（缺少或错误的 `x-agent-key`）
- `404`：数据不存在（symbol 找不到）
- `422`：参数组合不可计算（override 不合法或导致模型不可解）
- `500`：服务内部错误（可重试）

对 agent 的建议：
- `401`：不要重试，提示“key 无效/缺失”，需要人工修复配置。
- `404`：不要盲目重试；可提示用户检查 ticker（或尝试常见映射，如 `BRK.B`/`BRK-B` 之类）。
- `422`：提示用户哪个 override 导致不可计算（若 `details` 提供）。
- `500` / 网络超时：可以指数退避重试 1-3 次。

## 4. 请求示例
```bash
curl -X POST "https://dcf-agent-api.luiyezheng.workers.dev/v1/valuation" \
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

### 4.1 JavaScript（fetch）示例
```js
const baseUrl = "https://dcf-agent-api.luiyezheng.workers.dev";
const agentKey = process.env.AGENT_API_KEY; // 不要硬编码到代码仓库

const res = await fetch(`${baseUrl}/v1/valuation`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-agent-key": agentKey,
  },
  body: JSON.stringify({
    symbol: "AAPL",
    overrides: {
      dcf: { wacc: 0.095, drivers: [{ year: 2, operatingMargin: 0.24 }] },
      monteCarlo: { iterations: 4000 },
    },
    options: { includeDistribution: false },
  }),
});

const data = await res.json();
if (!res.ok) throw new Error(JSON.stringify(data));
console.log(data.meta.requestId, data.results.perpetuity?.dcf?.fairValuePerShare);
```

### 4.2 Python（requests）示例
```python
import os, requests

base_url = "https://dcf-agent-api.luiyezheng.workers.dev"
agent_key = os.environ["AGENT_API_KEY"]

r = requests.post(
    f"{base_url}/v1/valuation",
    headers={"x-agent-key": agent_key},
    json={
        "symbol": "AAPL",
        "options": {"includeDistribution": False},
    },
    timeout=60,
)
data = r.json()
r.raise_for_status()
print(data["meta"]["requestId"])
```

## 5. 默认行为
- 若不传 `overrides`，系统自动使用预填参数。
- `iterations` 默认 `3000`，最大 `20000`（超出自动钳制并写入 `warnings`）。
- `includeDistribution` 默认 `false`（只返回分位数摘要）。
- 若 `terminalGrowthRate >= wacc`，自动下修并写入 `warnings`。

## 6. OpenAPI（供 agent 自动适配）
建议 agent 优先读取 OpenAPI 以适配字段：
- `GET https://dcf-agent-api.luiyezheng.workers.dev/openapi.json`
- `GET https://dcf-agent-api.luiyezheng.workers.dev/openapi.yaml`

仓库内规范文件位置：
- `openapi/openapi.yaml`
- `openapi/openapi.json`

## 7. Agent 调用策略（实战建议）
- 只需要“估值点位 + 解释”时：`includeDistribution=false`（更快）。
- 需要做不确定性呈现（例如画扇形图/区间）：`includeDistribution=true`。
- 输出建议至少包含：
  - 终值方法：perpetuity / roicDriven / fade 的对比
  - 关键假设：wacc、terminalGrowthRate（或 fade 参数）
  - 任何 warnings（例如被钳制或自动下修）
  - `requestId`（用于排障）

## 8. 本地与更新（维护者）
可用脚本刷新 OpenAPI：
```bash
npm run openapi:generate
```
