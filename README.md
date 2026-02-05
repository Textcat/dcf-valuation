# DCF Validation Framework

[中文](#中文) | [English](#english)

---

## 中文

一个“可快速检验”的 DCF 估值系统，强调三层验证闭环：
- **Layer A（近端层）**：用季度/年度数据验证显性期经营与现金流
- **Layer B（结构层）**：用会计一致性与经济恒等式做即时体检
- **Layer C（反推层）**：由市场价格反推隐含假设，做反证校验

在线体验：[dcf-valuation.pages.dev](https://dcf-valuation.pages.dev)

## 主要特性
- **三层验证闭环**：显性期校验 + 结构一致性 + 市场隐含假设
- **多终值方法**：永续增长、ROIC 驱动、Fade 衰减模型
- **Monte Carlo**：输出估值分布区间（P10/P50/P90）
- **历史快照**：保存并对比模型版本
- **数据源**：Financial Modeling Prep（FMP）API
- **鉴权**：Supabase Auth

## 技术栈
- React 19 + Vite 6 + TypeScript
- Tailwind CSS v4
- Zustand + Dexie（本地存储）
- Supabase JS
- Cloudflare Pages Functions（FMP 代理）

## 快速开始

### 1) 安装依赖
```bash
npm install
```

### 2) 配置环境变量
创建 `.env`：
```bash
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_supabase_anon_key
# 可选：自定义前端请求的 FMP 代理地址
# VITE_FMP_PROXY_BASE=/api/fmp
```

如需本地使用 Cloudflare Pages Functions 代理 FMP：
```bash
# 复制并编辑
cp .dev.vars.example .dev.vars
# 在 .dev.vars 中填写
FMP_API_KEY=你的_fmp_api_key
```

### 3) 启动开发环境
方式 A（推荐，含本地 Functions 代理）：
```bash
# 终端 1
npm run dev

# 终端 2
npm run dev:cf
```

方式 B（仅前端，需自备可用代理或直连配置）：
```bash
npm run dev
```

> 默认前端会请求 `/api/fmp/*`。使用 `npm run dev:cf` 可提供本地 Functions 代理。

### 4) 构建与预览
```bash
npm run build
npm run preview
```

### 5) 运行命令行估值脚本
```bash
# 需要环境变量 FMP_API_KEY
FMP_API_KEY=你的_fmp_api_key npm run valuation -- AAPL MSFT
# 可选：指定 Monte Carlo 迭代次数
FMP_API_KEY=你的_fmp_api_key npm run valuation -- AAPL --iterations 3000
```

## 目录结构
```
functions/            # Cloudflare Pages Functions (FMP 代理)
scripts/              # CLI 估值脚本
src/
  components/         # UI 组件
  engines/            # DCF / Monte Carlo / 结构校验引擎
  services/           # FMP / Supabase / 本地存储
  stores/             # Zustand 状态管理
  data/               # 行业基准与静态数据
```

## 常用命令
- `npm run dev`：本地开发（Vite）
- `npm run dev:cf`：本地 Functions 代理（需先运行 `npm run dev`）
- `npm run build`：生产构建
- `npm run preview`：本地预览
- `npm run lint`：代码检查
- `npm run test`：单元测试
- `npm run valuation -- <TICKERS>`：命令行估值

## 说明
- 本项目默认通过 `/api/fmp` 访问 FMP（由 Cloudflare Functions 代理转发）。
- 若你在其他环境部署，请确保提供等价的 FMP 代理或在服务端设置 `FMP_API_KEY`。

## License
MIT

---

## English

A “fast-to-validate” DCF valuation system with a three-layer validation loop:
- **Layer A (Near-term)**: validate explicit-period operations and cash flows with quarterly/annual data
- **Layer B (Structural)**: instant checks via accounting consistency and economic identities
- **Layer C (Reverse-engineered)**: infer market-implied assumptions and validate by contradiction

Live site: [dcf-valuation.pages.dev](https://dcf-valuation.pages.dev)

### Key Features
- **Three-layer validation**: explicit-period checks + structural consistency + market-implied assumptions
- **Multiple terminal methods**: perpetuity, ROIC-driven, fade model
- **Monte Carlo**: valuation distribution (P10/P50/P90)
- **Snapshot history**: save and compare model versions
- **Data source**: Financial Modeling Prep (FMP) API
- **Auth**: Supabase Auth

### Tech Stack
- React 19 + Vite 6 + TypeScript
- Tailwind CSS v4
- Zustand + Dexie (local storage)
- Supabase JS
- Cloudflare Pages Functions (FMP proxy)

### Quick Start

1. Install dependencies
```bash
npm install
```

2. Configure environment variables
Create `.env`:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional: custom FMP proxy base for the frontend
# VITE_FMP_PROXY_BASE=/api/fmp
```

If you want to use Cloudflare Pages Functions locally for the FMP proxy:
```bash
cp .dev.vars.example .dev.vars
FMP_API_KEY=your_fmp_api_key
```

3. Start development
Option A (recommended, with local Functions proxy):
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:cf
```

Option B (frontend only, requires your own proxy or direct configuration):
```bash
npm run dev
```

4. Build & preview
```bash
npm run build
npm run preview
```

5. Run CLI valuation
```bash
FMP_API_KEY=your_fmp_api_key npm run valuation -- AAPL MSFT
FMP_API_KEY=your_fmp_api_key npm run valuation -- AAPL --iterations 3000
```

### Project Structure
```
functions/            # Cloudflare Pages Functions (FMP proxy)
scripts/              # CLI valuation script
src/
  components/         # UI components
  engines/            # DCF / Monte Carlo / structural checks
  services/           # FMP / Supabase / local storage
  stores/             # Zustand state
  data/               # industry benchmarks & static data
```

### Common Commands
- `npm run dev`: local dev (Vite)
- `npm run dev:cf`: local Functions proxy (run after `npm run dev`)
- `npm run build`: production build
- `npm run preview`: local preview
- `npm run lint`: lint
- `npm run test`: tests
- `npm run valuation -- <TICKERS>`: CLI valuation

### Notes
- The frontend defaults to `/api/fmp` for FMP access (proxied by Cloudflare Functions).
- For other deployments, provide an equivalent proxy or set `FMP_API_KEY` server-side.

### License
MIT
