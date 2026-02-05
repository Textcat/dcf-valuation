# DCF 估值公式与参数追踪文档

目的
- 记录当前估值模型的所有公式与参数来源，确保后续每一次修订可精确追踪。
- 明确自动填入参数的 FMP API 端口与字段。
- 明确由其他参数计算得到的参数及其计算公式。

版本历史
| 版本ID | 日期 | 摘要 | 参考实现 |
|---|---|---|---|
| v2026-02-05 | 2026-02-05 | 建立全量公式与参数溯源文档（显式期 + 三种终值 + WACC + 数据来源） | `src/engines/dcf-engine.ts` `src/stores/appStore.ts` `src/services/fmp.ts` |

范围与实现位置
- DCF 主引擎: `src/engines/dcf-engine.ts`
- DCF 输入初始化与自动填充: `src/stores/appStore.ts`
- FMP 数据抓取与指标派生: `src/services/fmp.ts`

记号约定
- N: 显式期年数 (inputs.explicitPeriodYears)
- y: 显式期年份索引 (1..N)
- WACC: 折现率 (inputs.wacc)
- g_end: 终值永续增长率 (inputs.terminalGrowthRate)
- ROIC_end: 稳态 ROIC (inputs.steadyStateROIC)
- g_start: 渐退期起始增长率 (inputs.fadeStartGrowth)
- ROIC_start: 渐退期起始 ROIC (inputs.fadeStartROIC)
- Revenue_0: 基期营收 (inputs.baseRevenue)

========================================
FMP API 端口与原始字段
========================================

FMP Base URL
- https://financialmodelingprep.com/stable

端口与字段映射
| 端口 | 关键字段 | 用途 |
|---|---|---|
| profile | price, marketCap, currency, beta, sector, industry, companyName | 当前价格、市值、交易货币、β、行业分类、公司名 |
| income-statement (quarter, limit=4) | revenue, grossProfit, operatingIncome, netIncome, interestExpense, weightedAverageShsOutDil, reportedCurrency | TTM 收入与利润、TTM 利息支出、流通股数、财报货币 |
| income-statement (annual, limit=3) | revenue, incomeTaxExpense, incomeBeforeTax | 有效税率、历史比率计算基数 |
| cash-flow-statement (quarter, limit=4) | freeCashFlow, depreciationAndAmortization, capitalExpenditure, changeInWorkingCapital, stockBasedCompensation | TTM FCF、TTM D&A、TTM CapEx、TTM WC 变动、TTM SBC |
| cash-flow-statement (annual, limit=3) | depreciationAndAmortization, capitalExpenditure, changeInWorkingCapital | 历史 D&A%、CapEx%、WC 变动率 |
| balance-sheet-statement (limit=1) | totalStockholdersEquity, totalDebt, cashAndCashEquivalents | 总权益、总债务、现金，计算 ROIC 与净现金 |
| analyst-estimates (annual, limit=5) | revenueAvg, revenueLow, revenueHigh, epsAvg, epsLow, epsHigh, numAnalystsEps | 收入增长与 EPS 分歧度 |
| key-metrics (limit=5) | peRatio, priceToFreeCashFlowsRatio, freeCashFlowYield | 估值分位数 |
| treasury-rates (limit=1) | year10 | 无风险利率 (10Y) |
| market-risk-premium | totalEquityRiskPremium, countryRiskPremium | 市场风险溢价与国家风险溢价 |

非 FMP 数据源
- 汇率: https://api.exchangerate-api.com/v4/latest/USD
- 用途: 将财报货币与交易货币统一为 USD 口径。

========================================
财务数据派生公式 (ExtendedFinancialData)
========================================

汇率
- 财报口径汇率: exchangeRate = ExchangeRate(reportedCurrency)
- 价格口径汇率: priceExchangeRate = ExchangeRate(profile.currency)
- 说明: 财报数据使用 reportedCurrency，股价与市值使用 profile.currency。

TTM 汇总 (来自 quarterly income-statement / cash-flow-statement)
- ttmRevenue = Σ revenue_q (最近4季) × exchangeRate
- ttmGrossProfit = Σ grossProfit_q × exchangeRate
- ttmOperatingIncome = Σ operatingIncome_q × exchangeRate
- ttmNetIncome = Σ netIncome_q × exchangeRate
- ttmInterestExpense = Σ interestExpense_q × exchangeRate
- ttmFCF = Σ freeCashFlow_q × exchangeRate
- ttmDA = Σ depreciationAndAmortization_q × exchangeRate
- ttmCapex = Σ |capitalExpenditure_q| × exchangeRate
- ttmWCChange = Σ changeInWorkingCapital_q × exchangeRate
- ttmSBC = Σ stockBasedCompensation_q × exchangeRate
- sharesOutstanding = weightedAverageShsOutDil(最新季度)

TTM 比率
- grossMargin = ttmGrossProfit / ttmRevenue
- operatingMargin = ttmOperatingIncome / ttmRevenue
- netMargin = ttmNetIncome / ttmRevenue
- ttmEPS = ttmNetIncome / sharesOutstanding

有效税率 (annual income-statement)
- 对每个年度: taxRate_i = incomeTaxExpense_i / incomeBeforeTax_i
- 过滤条件: incomeBeforeTax_i > 0 且 taxRate_i 在 [0, 0.60]
- effectiveTaxRate = clamp(avg(taxRate_i), 0.05, 0.45)

历史比率 (annual income-statement + cash-flow-statement)
- annualRevenue = latestAnnualRevenue × exchangeRate
- historicalDAPercent = |latestAnnualDA| / annualRevenue
- historicalCapexPercent = |latestAnnualCapex| / annualRevenue
- historicalWCChangePercent
  - revenueChange = annualRevenue - prevAnnualRevenue
  - wcChange = -latestAnnualChangeInWorkingCapital × exchangeRate
  - historicalWCChangePercent = clamp(wcChange / revenueChange, -0.30, 0.30)

历史 ROIC (balance-sheet + ttm)
- totalEquity = totalStockholdersEquity × exchangeRate
- totalDebt = totalDebt × exchangeRate
- totalCash = cashAndCashEquivalents × exchangeRate
- investedCapital = totalEquity + totalDebt - totalCash
- nopat = ttmOperatingIncome × (1 - effectiveTaxRate)
- historicalROIC = nopat / investedCapital

净现金
- netCash = totalCash - totalDebt

成本与估值分位
- currentPrice = profile.price × priceExchangeRate
- marketCap = profile.marketCap × priceExchangeRate
- currentPE = currentPrice / ttmEPS
- currentPFCF = marketCap / ttmFCF
- PEG 与估值分位数来源于 key-metrics 与 analyst-estimates

========================================
WACC 计算与参数来源
========================================

无风险利率 (Rf)
- 来源: treasury-rates.year10
- 转换: Rf = year10 / 100
- 合理区间: 若 Rf 不在 [0.001, 0.15]，回退默认值 0.045

市场风险溢价 (MRP)
- 来源: market-risk-premium.totalEquityRiskPremium (United States)
- 转换: MRP = totalEquityRiskPremium / 100
- 合理区间: 若 MRP 不在 [0.02, 0.12]，回退默认值 0.05

β (Beta)
- 来源: profile.beta
- 若缺失: 默认 1.0

权益资本成本 (Re)
- Re = Rf + Beta × MRP

债务成本 (Rd)
- 输入: interestExpense, totalDebt
- Rd_raw = interestExpense / totalDebt
- 规则: totalDebt <= 0 或 interestExpense < 0 则返回 0.06
- 夹取: 若 Rd_raw < 0.02 返回 0.04; 若 Rd_raw > 0.15 返回 0.10; 否则 Rd = Rd_raw

资本结构权重
- totalCapital = marketCap + totalDebt
- equityWeight = marketCap / totalCapital (若 totalCapital <= 0 则 0.8)
- debtWeight = 1 - equityWeight

税盾
- 税率使用 effectiveTaxRate

WACC
- WACC_raw = equityWeight × Re + debtWeight × Rd × (1 - effectiveTaxRate)
- WACC = clamp(WACC_raw, 0.06, 0.15)

========================================
DCF 输入参数 (DCFInputs) 与来源
========================================

基础参数
| 参数 | 来源类型 | 来源端口/字段 | 计算/规则 |
|---|---|---|---|
| symbol | 用户输入 | - | 股票代码 |
| explicitPeriodYears | 默认值 | - | 5 |
| baseRevenue | 自动 | income-statement (quarter) | baseRevenue = ttmRevenue |
| baseNetIncome | 自动 | income-statement (quarter) | baseNetIncome = ttmNetIncome；当前未参与 DCF 引擎计算 |

WACC 与终值参数
| 参数 | 来源类型 | 来源端口/字段 | 计算/规则 |
|---|---|---|---|
| wacc | 自动 | treasury-rates, market-risk-premium, profile, balance-sheet, income-statement | 见 WACC 公式 |
| terminalMethod | 默认值 | - | 'perpetuity' |
| terminalGrowthRate | 默认值 | - | 0.03 |
| steadyStateROIC | 自动 | balance-sheet + income-statement | steadyStateROIC = historicalROIC |
| fadeYears | 默认值 | - | 10 |
| fadeStartGrowth | 自动或默认 | analyst-estimates | 若有估算: growth*0.6，否则默认 0.10 |
| fadeStartROIC | 自动 | balance-sheet + income-statement | fadeStartROIC = historicalROIC |

显式期驱动因子 (drivers[y])
| 参数 | 来源类型 | 来源端口/字段 | 计算/规则 |
|---|---|---|---|
| revenueGrowth | 自动或默认 | analyst-estimates | 若 FY1/FY2 revenueAvg > 0: growth = FY2.revenueAvg/FY1.revenueAvg - 1；year1..5 = g, 0.9g, 0.8g, 0.7g, 0.6g。否则默认 0.10 |
| grossMargin | 自动或默认 | income-statement (quarter) | ttmGrossProfit / ttmRevenue (若 >0，否则默认 0.40)；当前未参与 FCF 计算 |
| operatingMargin | 自动或默认 | income-statement (quarter) | ttmOperatingIncome / ttmRevenue (若 >0，否则默认 0.20) |
| taxRate | 自动或默认 | income-statement (annual) | effectiveTaxRate (若不可得，则默认 0.21) |
| daPercent | 自动或默认 | cash-flow-statement (annual) | historicalDAPercent (若不可得，则默认 0.03) |
| capexPercent | 自动或默认 | cash-flow-statement (annual) | historicalCapexPercent (若不可得，则默认 0.04) |
| wcChangePercent | 自动或默认 | cash-flow-statement (annual) | historicalWCChangePercent (若不可得，则默认 0.01) |

========================================
显式期估值公式 (Year y = 1..N)
========================================

营收
- Revenue_y = Revenue_{y-1} × (1 + revenueGrowth_y)
- ΔRevenue_y = Revenue_y - Revenue_{y-1}

营业利润
- OperatingIncome_y = Revenue_y × operatingMargin_y

NOPAT
- NOPAT_y = OperatingIncome_y × (1 - taxRate_y)

现金流构成
- DA_y = Revenue_y × daPercent_y
- CapEx_y = Revenue_y × capexPercent_y
- ΔWC_y = ΔRevenue_y × wcChangePercent_y

自由现金流
- FCF_y = NOPAT_y + DA_y - CapEx_y - ΔWC_y

折现
- DiscountFactor_y = (1 + WACC)^y
- PV_y = FCF_y / DiscountFactor_y

显式期现值合计
- ExplicitPV = Σ(PV_y, y=1..N)

========================================
终值模型 1: 永续增长 (perpetuity)
========================================

终值
- TV = FCF_N × (1 + g_end) / (WACC - g_end)

终值现值
- TV_PV = TV / (1 + WACC)^N

========================================
终值模型 2: ROIC 驱动 (roic-driven)
========================================

再投资率
- Reinvestment = g_end / ROIC_end

稳态 NOPAT
- NOPAT_{N+1} = NOPAT_N × (1 + g_end)

稳态 FCF
- FCF_terminal = NOPAT_{N+1} × (1 - Reinvestment)

终值
- TV = FCF_terminal / (WACC - g_end)

终值现值
- TV_PV = TV / (1 + WACC)^N

========================================
终值模型 3: 渐退模型 (fade)
========================================

渐退期参数
- fadeYears, g_start, g_end, ROIC_start, ROIC_end

渐退期逐年计算 (y = 1..fadeYears)
- fadeFactor_y = 1 - y / fadeYears
- g_y = g_end + (g_start - g_end) × fadeFactor_y
- ROIC_y = ROIC_end + (ROIC_start - ROIC_end) × fadeFactor_y
- Reinvestment_y = g_y / ROIC_y (ROIC_y < 0.001 时视为 0)
- NOPAT_y = NOPAT_{y-1} × (1 + g_y)
- FCF_y = NOPAT_y × (1 - Reinvestment_y)
- PV_y = FCF_y / (1 + WACC)^(N + y)

渐退期现值
- FadePV = Σ(PV_y, y=1..fadeYears)

稳态延续期
- NOPAT_post = NOPAT_{fadeEnd} × (1 + g_end)
- Reinvestment_post = g_end / ROIC_end (ROIC_end < 0.001 时视为 0)
- FCF_post = NOPAT_post × (1 - Reinvestment_post)
- TV_post = FCF_post / (WACC - g_end)
- PV_post = TV_post / (1 + WACC)^(N + fadeYears)

终值 (显式期末时点)
- TV = (FadePV + PV_post) × (1 + WACC)^N

终值现值
- TV_PV = TV / (1 + WACC)^N

========================================
企业价值与股权价值
========================================

企业价值
- EnterpriseValue = ExplicitPV + TV_PV

股权价值
- EquityValue = EnterpriseValue + netCash

每股公允价值
- FairValuePerShare = EquityValue / sharesOutstanding

衍生估值指标
- ImpliedPE = FairValuePerShare / ttmEPS
- ImpliedEVtoFCF = EnterpriseValue / ttmFCF

========================================
更新指引 (用于后续版本修订)
========================================

每次修改估值模型时，请更新以下内容
- 版本历史表新增一行，写明日期与修改摘要。
- 若新增或变更参数来源，更新 “FMP API 端口与原始字段” 与 “DCF 输入参数与来源”。
- 若修改公式，更新对应的公式区块并标注公式变更原因。
- 若修改默认值或夹取规则，更新所有相关表格中的默认值与 clamp 规则。
